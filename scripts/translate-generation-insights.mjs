import "dotenv/config";
import pg from "pg";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "YOUR_API_KEY_HERE";
const GOOGLE_AI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash'];
const LOCALES = ['en', 'fr', 'nl', 'de']; // ru is source

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function translateInsights(insights, locale) {
  const localeNames = { en: 'English', fr: 'French', nl: 'Dutch', de: 'German' };

  const prompt = `Translate these vehicle insights to ${localeNames[locale]}:

Input (Russian):
{
  "pros": ${JSON.stringify(insights.pros)},
  "cons": ${JSON.stringify(insights.cons)},
  "inspection_tips": ${JSON.stringify(insights.inspection_tips)},
  "notable_features": ${JSON.stringify(insights.notable_features)},
  "engine_examples": ${JSON.stringify(insights.engine_examples)},
  "common_issues": ${JSON.stringify(insights.common_issues)}
}

Return exact same JSON structure in ${localeNames[locale]}.
Keep engine codes unchanged (e.g., "M50B25" stays "M50B25").
Only valid JSON, no markdown.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${GOOGLE_AI_MODELS[0]}:generateContent?key=${GOOGLE_API_KEY}`,
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
  return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
}

async function main() {
  try {
    await client.connect();
    console.log("\n🌐 Translating generation insights...\n");

    // Get all generation insights that need translation
    const { rows: insights } = await client.query(`
      SELECT
        vgi.generation_id,
        vgi.pros,
        vgi.cons,
        vgi.inspection_tips,
        vgi.notable_features,
        vgi.engine_examples,
        vgi.common_issues,
        vg.code,
        vm.name_en as model_name,
        vmk.name_en as make_name
      FROM vehicle_generation_insights vgi
      JOIN vehicle_generations vg ON vg.id = vgi.generation_id
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      ORDER BY vmk.name_en, vm.name_en, vg.start_year
    `);

    console.log(`Found ${insights.length} generations to translate\n`);

    let processed = 0;

    for (const insight of insights) {
      for (const locale of LOCALES) {
        try {
          // Check if already exists
          const { rows: existing } = await client.query(
            `SELECT generation_id FROM vehicle_generation_insights_i18n
             WHERE generation_id = $1 AND locale = $2`,
            [insight.generation_id, locale]
          );

          if (existing.length > 0) {
            console.log(`⏭️  ${insight.make_name} ${insight.model_name} ${insight.code} [${locale}] exists`);
            continue;
          }

          console.log(`🔄 Translating: ${insight.make_name} ${insight.model_name} ${insight.code} → ${locale}`);

          const translated = await translateInsights(insight, locale);

          await client.query(`
            INSERT INTO vehicle_generation_insights_i18n (
              generation_id, locale, pros, cons, inspection_tips,
              notable_features, engine_examples, common_issues
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            insight.generation_id,
            locale,
            translated.pros,
            translated.cons,
            translated.inspection_tips,
            translated.notable_features,
            translated.engine_examples,
            translated.common_issues
          ]);

          console.log(`✅ ${locale} done`);
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          console.error(`❌ Error translating ${insight.make_name} ${insight.model_name} ${insight.code} to ${locale}:`, error.message);
        }
      }

      processed++;
      if (processed % 5 === 0) {
        console.log(`\n📊 Progress: ${processed}/${insights.length}\n`);
      }
    }

    console.log("\n✅ Translation complete!");

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();

