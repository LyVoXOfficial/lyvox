# 🎯 ЗАДАЧА: Добавить generation_id в vehicle_insights и регенерировать данные

## 📋 КОНТЕКСТ

**Проблема:** Сейчас `vehicle_insights` привязаны только к `model_id` (например, вся модель BMW 5-series), что приводит к неправильным данным для старых поколений. BMW E34 (1988-1996) показывает информацию о двигателях N55/N63, которые появились только в 2007+ году!

**Решение:** Добавить `generation_id` в `vehicle_insights` и сгенерировать insights для КАЖДОГО поколения отдельно.

---

## 📊 ТЕКУЩАЯ СТРУКТУРА БД

```sql
-- СЕЙЧАС: insights привязаны только к model_id
CREATE TABLE vehicle_insights (
    model_id UUID PRIMARY KEY REFERENCES vehicle_models(id),
    pros TEXT[],
    cons TEXT[],
    inspection_tips TEXT[],
    notable_features TEXT[],
    engine_examples TEXT[],
    common_issues TEXT[],
    reliability_score INTEGER,
    popularity_score INTEGER
);

-- Есть таблица поколений
CREATE TABLE vehicle_generations (
    id UUID PRIMARY KEY,
    model_id UUID REFERENCES vehicle_models(id),
    code TEXT,  -- "E34", "F10", etc.
    start_year INT,
    end_year INT,
    body_types TEXT[],
    fuel_types TEXT[],
    transmission_types TEXT[]
);

-- Есть переводы insights (они тоже привязаны к model_id)
CREATE TABLE vehicle_insights_i18n (
    model_id UUID REFERENCES vehicle_insights(model_id),
    locale TEXT,  -- 'en', 'fr', 'nl', 'ru', 'de'
    pros TEXT[],
    cons TEXT[],
    inspection_tips TEXT[],
    notable_features TEXT[],
    engine_examples TEXT[],
    common_issues TEXT[]
);
```

---

## 🎯 ЦЕЛЬ

**ПОСЛЕ изменений:**

- `vehicle_insights` будут привязаны к `generation_id` (не `model_id`)
- BMW E34 получит свои insights (M20, M50, M60 двигатели)
- BMW F10 получит свои insights (N55, N63 двигатели)
- Все переводы также будут для конкретных поколений

---

## 📝 ПЛАН ВЫПОЛНЕНИЯ (ВСЁ АВТОМАТИЧЕСКИ)

### **ШАГ 1: Создать миграцию БД**

Создать файл `supabase/migrations/YYYYMMDDHHMMSS_generation_insights.sql`:

```sql
-- 1. Создать новую таблицу vehicle_generation_insights (временно)
CREATE TABLE IF NOT EXISTS public.vehicle_generation_insights (
    generation_id UUID PRIMARY KEY REFERENCES public.vehicle_generations(id) ON DELETE CASCADE,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    inspection_tips TEXT[] DEFAULT '{}',
    notable_features TEXT[] DEFAULT '{}',
    engine_examples TEXT[] DEFAULT '{}',
    common_issues TEXT[] DEFAULT '{}',
    reliability_score INTEGER,
    popularity_score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Создать таблицу переводов для поколений
CREATE TABLE IF NOT EXISTS public.vehicle_generation_insights_i18n (
    generation_id UUID NOT NULL REFERENCES public.vehicle_generation_insights(generation_id) ON DELETE CASCADE,
    locale TEXT NOT NULL CHECK (locale = ANY (ARRAY['en'::TEXT, 'fr'::TEXT, 'nl'::TEXT, 'ru'::TEXT, 'de'::TEXT])),
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    inspection_tips TEXT[] DEFAULT '{}',
    notable_features TEXT[] DEFAULT '{}',
    engine_examples TEXT[] DEFAULT '{}',
    common_issues TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (generation_id, locale)
);

-- 3. Создать индексы
CREATE INDEX IF NOT EXISTS vehicle_generation_insights_generation_id_idx
    ON public.vehicle_generation_insights(generation_id);

CREATE INDEX IF NOT EXISTS vehicle_generation_insights_i18n_generation_id_idx
    ON public.vehicle_generation_insights_i18n(generation_id);

CREATE INDEX IF NOT EXISTS vehicle_generation_insights_i18n_locale_idx
    ON public.vehicle_generation_insights_i18n(locale);

-- 4. Добавить RLS политики (если нужны для чтения)
ALTER TABLE public.vehicle_generation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_generation_insights_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_generation_insights_read" ON public.vehicle_generation_insights
    FOR SELECT USING (true);

CREATE POLICY "vehicle_generation_insights_i18n_read" ON public.vehicle_generation_insights_i18n
    FOR SELECT USING (true);
```

**Применить миграцию:** `pnpm supabase db push`

---

### **ШАГ 2: Скрипт для генерации insights по поколениям**

Создать `scripts/generate-generation-insights.mjs`:

```javascript
import "dotenv/config";
import pg from "pg";

const GOOGLE_API_KEY = "AIzaSyBDKpcCjVrleEqDJXhGytt1zzmka58vuWY";
const GOOGLE_AI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function callGoogleAI(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const model of GOOGLE_AI_MODELS) {
      try {
        const response = await fetch(
          \`https://generativelanguage.googleapis.com/v1/models/\${model}:generateContent?key=\${GOOGLE_API_KEY}\`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
              },
            }),
          }
        );

        if (!response.ok) {
          console.warn(\`Model \${model} failed: \${response.status}\`);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          console.warn(\`No text from \${model}\`);
          continue;
        }

        return text.replace(/\`\`\`json\\s*/g, '').replace(/\`\`\`\\s*/g, '').trim();
      } catch (error) {
        console.warn(\`Error with \${model}:\`, error.message);
      }
    }

    if (attempt < retries - 1) {
      console.log(\`Retry \${attempt + 1}/\${retries} in 2s...\`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error("All AI models failed");
}

async function generateInsightsForGeneration(generation, makeName, modelName) {
  const yearRange = generation.end_year
    ? \`\${generation.start_year}-\${generation.end_year}\`
    : \`\${generation.start_year}+\`;

  const prompt = \`Generate detailed vehicle insights for:

Make: \${makeName}
Model: \${modelName}
Generation: \${generation.code || 'N/A'}
Years: \${yearRange}
Body Types: \${generation.body_types?.join(', ') || 'Unknown'}
Fuel Types: \${generation.fuel_types?.join(', ') || 'Unknown'}
Transmission: \${generation.transmission_types?.join(', ') || 'Unknown'}

IMPORTANT: Generate data SPECIFICALLY for this generation and year range.
Use engines, technology, and issues that were ACTUALLY available in \${yearRange}.
DO NOT mention technology from other generations or time periods.

Return JSON with:
{
  "pros": [3-5 advantages, specific to this generation],
  "cons": [3-5 disadvantages, specific to this generation],
  "inspection_tips": [4-6 tips for buyers, generation-specific],
  "notable_features": [3-5 notable features, generation-specific],
  "engine_examples": [3-5 actual engine codes from this generation, e.g., "M50B25", "M60B30"],
  "common_issues": [3-5 known problems, generation-specific],
  "reliability_score": INTEGER 1-10 (reliability rating),
  "popularity_score": INTEGER 1-10 (popularity rating)
}

All text in Russian. Only valid JSON, no markdown.\`;

  const responseText = await callGoogleAI(prompt);
  return JSON.parse(responseText);
}

async function main() {
  try {
    await client.connect();
    console.log("\\n🚀 Generating insights for ALL generations...\\n");

    // Get all generations with their make/model info
    const { rows: generations } = await client.query(\`
      SELECT
        vg.id as generation_id,
        vg.code,
        vg.start_year,
        vg.end_year,
        vg.body_types,
        vg.fuel_types,
        vg.transmission_types,
        vm.name_en as model_name,
        vmk.name as make_name,
        vm.id as model_id
      FROM vehicle_generations vg
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      WHERE vg.code IS NOT NULL
        AND vg.code != ''
      ORDER BY vmk.name, vm.name_en, vg.start_year
    \`);

    console.log(\`Found \${generations.length} generations to process\\n\`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const gen of generations) {
      try {
        // Check if already exists
        const { rows: existing } = await client.query(
          \`SELECT generation_id FROM vehicle_generation_insights WHERE generation_id = $1\`,
          [gen.generation_id]
        );

        if (existing.length > 0) {
          console.log(\`⏭️  Skipping \${gen.make_name} \${gen.model_name} \${gen.code} (already exists)\`);
          skipped++;
          continue;
        }

        console.log(\`\\n🔄 Processing: \${gen.make_name} \${gen.model_name} \${gen.code} (\${gen.start_year}-\${gen.end_year || 'now'})\`);

        const insights = await generateInsightsForGeneration(gen, gen.make_name, gen.model_name);

        // Insert into DB
        await client.query(\`
          INSERT INTO vehicle_generation_insights (
            generation_id, pros, cons, inspection_tips, notable_features,
            engine_examples, common_issues, reliability_score, popularity_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        \`, [
          gen.generation_id,
          insights.pros,
          insights.cons,
          insights.inspection_tips,
          insights.notable_features,
          insights.engine_examples,
          insights.common_issues,
          Math.round(parseFloat(insights.reliability_score)),
          Math.round(parseFloat(insights.popularity_score))
        ]);

        console.log(\`✅ Generated insights for \${gen.make_name} \${gen.model_name} \${gen.code}\`);
        processed++;

        // Progress report every 10 items
        if (processed % 10 === 0) {
          console.log(\`\\n📊 Progress: \${processed}/\${generations.length} (\${Math.round(processed/generations.length*100)}%)\\n\`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(\`❌ Error for \${gen.make_name} \${gen.model_name} \${gen.code}:\`, error.message);
        errors++;
      }
    }

    console.log(\`\\n✅ COMPLETE!\\n\`);
    console.log(\`Processed: \${processed}\`);
    console.log(\`Skipped: \${skipped}\`);
    console.log(\`Errors: \${errors}\`);

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
```

**Запустить:** `node scripts/generate-generation-insights.mjs`

---

### **ШАГ 3: Скрипт для перевода на 5 языков**

Создать `scripts/translate-generation-insights.mjs`:

```javascript
import "dotenv/config";
import pg from "pg";

const GOOGLE_API_KEY = "AIzaSyBDKpcCjVrleEqDJXhGytt1zzmka58vuWY";
const GOOGLE_AI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash'];
const LOCALES = ['en', 'fr', 'nl', 'de']; // ru is source

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function translateInsights(insights, locale) {
  const localeNames = { en: 'English', fr: 'French', nl: 'Dutch', de: 'German' };

  const prompt = \`Translate these vehicle insights to \${localeNames[locale]}:

Input (Russian):
{
  "pros": \${JSON.stringify(insights.pros)},
  "cons": \${JSON.stringify(insights.cons)},
  "inspection_tips": \${JSON.stringify(insights.inspection_tips)},
  "notable_features": \${JSON.stringify(insights.notable_features)},
  "engine_examples": \${JSON.stringify(insights.engine_examples)},
  "common_issues": \${JSON.stringify(insights.common_issues)}
}

Return exact same JSON structure in \${localeNames[locale]}.
Keep engine codes unchanged (e.g., "M50B25" stays "M50B25").
Only valid JSON, no markdown.\`;

  const response = await fetch(
    \`https://generativelanguage.googleapis.com/v1/models/\${GOOGLE_AI_MODELS[0]}:generateContent?key=\${GOOGLE_API_KEY}\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(text.replace(/\`\`\`json\\s*/g, '').replace(/\`\`\`\\s*/g, '').trim());
}

async function main() {
  try {
    await client.connect();
    console.log("\\n🌐 Translating generation insights...\\n");

    // Get all generation insights that need translation
    const { rows: insights } = await client.query(\`
      SELECT
        vgi.generation_id,
        vgi.pros,
        vgi.cons,
        vgi.inspection_tips,
        vgi.notable_features,
        vgi.engine_examples,
        vgi.common_issues,
        vg.code,
        vm.name_en,
        vmk.name
      FROM vehicle_generation_insights vgi
      JOIN vehicle_generations vg ON vg.id = vgi.generation_id
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      ORDER BY vmk.name, vm.name_en, vg.start_year
    \`);

    console.log(\`Found \${insights.length} generations to translate\\n\`);

    let processed = 0;

    for (const insight of insights) {
      for (const locale of LOCALES) {
        try {
          // Check if already exists
          const { rows: existing } = await client.query(
            \`SELECT generation_id FROM vehicle_generation_insights_i18n
             WHERE generation_id = $1 AND locale = $2\`,
            [insight.generation_id, locale]
          );

          if (existing.length > 0) {
            console.log(\`⏭️  \${insight.name} \${insight.name_en} \${insight.code} [\${locale}] exists\`);
            continue;
          }

          console.log(\`🔄 Translating: \${insight.name} \${insight.name_en} \${insight.code} → \${locale}\`);

          const translated = await translateInsights(insight, locale);

          await client.query(\`
            INSERT INTO vehicle_generation_insights_i18n (
              generation_id, locale, pros, cons, inspection_tips,
              notable_features, engine_examples, common_issues
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          \`, [
            insight.generation_id,
            locale,
            translated.pros,
            translated.cons,
            translated.inspection_tips,
            translated.notable_features,
            translated.engine_examples,
            translated.common_issues
          ]);

          console.log(\`✅ \${locale} done\`);
          await new Promise(resolve => setTimeout(resolve, 800));

        } catch (error) {
          console.error(\`❌ Error translating \${insight.name} \${insight.name_en} \${insight.code} to \${locale}:\`, error.message);
        }
      }

      processed++;
      if (processed % 5 === 0) {
        console.log(\`\\n📊 Progress: \${processed}/\${insights.length}\\n\`);
      }
    }

    console.log("\\n✅ Translation complete!");

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
```

**Запустить:** `node scripts/translate-generation-insights.mjs`

---

### **ШАГ 4: Обновить фронтенд**

Обновить `apps/web/src/app/ad/[id]/page.tsx`:

**БЫЛО:**

```typescript
const { data: insightsData } = await supabase
  .from("vehicle_insights")
  .select("*")
  .eq("model_id", loadedAdvert.specifics.model_id)
  .maybeSingle();
```

**СТАЛО:**

```typescript
// Get generation_id from specifics
const generationId = loadedAdvert.specifics.generation_id;

if (generationId) {
  const { data: insightsData } = await supabase
    .from("vehicle_generation_insights")
    .select("*")
    .eq("generation_id", generationId)
    .maybeSingle();

  if (!cancelled && insightsData) {
    // Load translations separately
    const { data: i18nData } = await supabase
      .from("vehicle_generation_insights_i18n")
      .select(
        "locale, pros, cons, inspection_tips, notable_features, engine_examples, common_issues",
      )
      .eq("generation_id", generationId);

    const combinedInsights = {
      ...insightsData,
      vehicle_generation_insights_i18n: i18nData || [],
    };

    setInsights(combinedInsights);
  }
}
```

Также обновить TypeScript типы:

```typescript
type VehicleInsights = {
  generation_id: string;
  pros: string[];
  cons: string[];
  inspection_tips: string[];
  notable_features: string[];
  engine_examples: string[];
  common_issues: string[];
  reliability_score: number;
  popularity_score: number;
  vehicle_generation_insights_i18n?: {
    locale: string;
    pros: string[];
    cons: string[];
    inspection_tips: string[];
    notable_features: string[];
    engine_examples: string[];
    common_issues: string[];
  }[];
};
```

---

### **ШАГ 5: После успешного завершения**

Когда всё заработает и данные валидные:

1. **Удалить старые таблицы:**

```sql
DROP TABLE IF EXISTS vehicle_insights_i18n CASCADE;
DROP TABLE IF EXISTS vehicle_insights CASCADE;
```

2. **Коммит:**

```bash
git add -A
git commit -m "feat: add generation-specific insights

- Add vehicle_generation_insights table
- Add vehicle_generation_insights_i18n for translations
- Generate insights for each generation separately
- Update frontend to use generation_id
- Remove old model-level insights

BMW E34 now shows M50/M60 engines instead of N55/N63"

git push origin main
```

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

**ДО:**

- BMW E34 (1988-1996): показывает N55B30, N63B44 (неправильно!)

**ПОСЛЕ:**

- BMW E34 (1988-1996): показывает M20B25, M50B25, M60B30 (правильно!)
- BMW F10 (2010-2017): показывает N55B30, N63B44 (правильно!)

---

## ⚡ КОМАНДЫ ДЛЯ ВЫПОЛНЕНИЯ

```bash
# 1. Применить миграцию
pnpm supabase db push

# 2. Сгенерировать insights (~2-4 часа для всех поколений)
node scripts/generate-generation-insights.mjs

# 3. Перевести на 5 языков (~3-5 часов)
node scripts/translate-generation-insights.mjs

# 4. Обновить фронтенд (файлы выше)

# 5. Тестировать
pnpm test

# 6. Коммит и пуш
git add -A
git commit -m "feat: generation-specific insights"
git push origin main
```

---

## 📊 ОЦЕНКА ВРЕМЕНИ

- **Миграция:** 1 минута
- **Генерация insights:** 2-4 часа (зависит от количества поколений)
- **Переводы:** 3-5 часов (4 языка × все поколения)
- **Обновление фронтенда:** 10-15 минут
- **Тестирование:** 10 минут

**ИТОГО: ~6-10 часов** (большая часть - автоматическая работа скриптов)

---

## ✅ КРИТЕРИИ УСПЕХА

1. ✅ В БД есть таблица `vehicle_generation_insights`
2. ✅ Каждое поколение имеет свои insights
3. ✅ BMW E34 показывает двигатели M20/M50/M60
4. ✅ BMW F10 показывает двигатели N55/N63
5. ✅ Все переводы работают на 5 языках
6. ✅ Фронтенд корректно отображает данные
7. ✅ Нет ошибок в консоли

---

## 🚨 ВАЖНО

- Google API key: **REMOVED FOR SECURITY** (use environment variable GOOGLE_API_KEY)
- Database URL: из `.env` файла (`DATABASE_URL`)
- Всё должно работать автоматически, без ручного ввода
- Скрипты должны продолжать работу после ошибок
- Прогресс должен сохраняться (можно перезапускать скрипты)

---

## 📝 ДОПОЛНИТЕЛЬНЫЕ ЗАМЕТКИ

- Если generation.code пустой - пропускать
- Если не удалось сгенерировать - записать в лог и продолжить
- API rate limit: 1 запрос в секунду (уже есть в скриптах)
- Для отладки можно сначала протестировать на 1 марке (например, только BMW)
