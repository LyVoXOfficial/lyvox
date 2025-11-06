import "dotenv/config";
import pg from "pg";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "YOUR_API_KEY_HERE";
const GOOGLE_AI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function callGoogleAI(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const model of GOOGLE_AI_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
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
          const errorData = await response.json().catch(() => ({}));
          console.warn(`Model ${model} failed: ${response.status}`);
          console.warn(`Error details:`, JSON.stringify(errorData, null, 2));
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          console.warn(`No text from ${model}`);
          continue;
        }

        return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      } catch (error) {
        console.warn(`Error with ${model}:`, error.message);
      }
    }

    if (attempt < retries - 1) {
      console.log(`Retry ${attempt + 1}/${retries} in 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error("All AI models failed");
}

async function generateInsightsForGeneration(generation, makeName, modelName) {
  const yearRange = generation.end_year
    ? `${generation.start_year}-${generation.end_year}`
    : `${generation.start_year}+`;

  const prompt = `Generate detailed vehicle insights for:

Make: ${makeName}
Model: ${modelName}
Generation: ${generation.code || 'N/A'}
Years: ${yearRange}
Body Types: ${generation.body_types?.join(', ') || 'Unknown'}
Fuel Types: ${generation.fuel_types?.join(', ') || 'Unknown'}
Transmission: ${generation.transmission_types?.join(', ') || 'Unknown'}

IMPORTANT: Generate data SPECIFICALLY for this generation and year range.
Use engines, technology, and issues that were ACTUALLY available in ${yearRange}.
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

All text in Russian. Only valid JSON, no markdown.`;

  const responseText = await callGoogleAI(prompt);
  return JSON.parse(responseText);
}

async function main() {
  try {
    await client.connect();
    console.log("\n🚀 Generating insights for ALL generations...\n");

    // Get all generations with their make/model info
    const { rows: generations } = await client.query(`
      SELECT
        vg.id as generation_id,
        vg.code,
        vg.start_year,
        vg.end_year,
        vg.body_types,
        vg.fuel_types,
        vg.transmission_types,
        vm.name_en as model_name,
        vmk.name_en as make_name,
        vm.id as model_id
      FROM vehicle_generations vg
      JOIN vehicle_models vm ON vm.id = vg.model_id
      JOIN vehicle_makes vmk ON vmk.id = vm.make_id
      WHERE vg.code IS NOT NULL
        AND vg.code != ''
      ORDER BY vmk.name_en, vm.name_en, vg.start_year
    `);

    console.log(`Found ${generations.length} generations to process\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const gen of generations) {
      try {
        // Check if already exists
        const { rows: existing } = await client.query(
          `SELECT generation_id FROM vehicle_generation_insights WHERE generation_id = $1`,
          [gen.generation_id]
        );

        if (existing.length > 0) {
          console.log(`⏭️  Skipping ${gen.make_name} ${gen.model_name} ${gen.code} (already exists)`);
          skipped++;
          continue;
        }

        console.log(`\n🔄 Processing: ${gen.make_name} ${gen.model_name} ${gen.code} (${gen.start_year}-${gen.end_year || 'now'})`);

        const insights = await generateInsightsForGeneration(gen, gen.make_name, gen.model_name);

        // Insert into DB
        await client.query(`
          INSERT INTO vehicle_generation_insights (
            generation_id, pros, cons, inspection_tips, notable_features,
            engine_examples, common_issues, reliability_score, popularity_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
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

        console.log(`✅ Generated insights for ${gen.make_name} ${gen.model_name} ${gen.code}`);
        processed++;

        // Progress report every 10 items
        if (processed % 10 === 0) {
          console.log(`\n📊 Progress: ${processed}/${generations.length} (${Math.round(processed/generations.length*100)}%)\n`);
        }

        // Rate limiting - increased for new API key
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error for ${gen.make_name} ${gen.model_name} ${gen.code}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ COMPLETE!\n`);
    console.log(`Processed: ${processed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();

