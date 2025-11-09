import "dotenv/config";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const model = 'gemini-2.0-flash-lite';

const testPrompt = `Generate detailed vehicle insights for:

Make: BMW
Model: 5 Series
Generation: E34
Years: 1988-1996
Body Types: Sedan, Wagon
Fuel Types: Petrol, Diesel
Transmission: Manual, Automatic

IMPORTANT: Generate data SPECIFICALLY for this generation and year range.
Use engines, technology, and issues that were ACTUALLY available in 1988-1996.
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

console.log('Testing real prompt from script...\n');
console.log(`Model: ${model}`);
console.log(`Prompt length: ${testPrompt.length} chars\n`);

try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  console.log(`Status: ${response.status}\n`);

  const data = await response.json();

  if (response.ok) {
    console.log('✅ SUCCESS!\n');
    console.log('Response:');
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(text?.substring(0, 500) + '...\n');
  } else {
    console.log('❌ FAILED!\n');
    console.log('Error details:');
    console.log(JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}






