import { describe, it, expect } from "vitest";
import { PROCESSING_ACTIVITIES, PROCESSORS } from "../processing";

describe("ROPA processing data", () => {
  it("PROCESSING_ACTIVITIES is non-empty", () => {
    expect(PROCESSING_ACTIVITIES.length).toBeGreaterThan(0);
  });

  it("PROCESSORS is non-empty", () => {
    expect(PROCESSORS.length).toBeGreaterThan(0);
  });

  it("every processor name referenced in an activity exists in PROCESSORS", () => {
    const knownNames = new Set(PROCESSORS.map((p) => p.name));
    const missing: { activity: string; processor: string }[] = [];

    for (const activity of PROCESSING_ACTIVITIES) {
      for (const processorName of activity.processors) {
        if (!knownNames.has(processorName)) {
          missing.push({ activity: activity.purpose, processor: processorName });
        }
      }
    }

    expect(
      missing,
      `Processor names referenced in activities but absent from PROCESSORS:\n${missing
        .map((m) => `  "${m.processor}" in "${m.activity}"`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("every activity has at least one processor", () => {
    const empty = PROCESSING_ACTIVITIES.filter((a) => a.processors.length === 0);
    expect(
      empty,
      `Activities with no processors:\n${empty.map((a) => `  "${a.purpose}"`).join("\n")}`,
    ).toEqual([]);
  });

  it("every activity has required fields non-empty", () => {
    for (const a of PROCESSING_ACTIVITIES) {
      expect(a.purpose.length, `Empty purpose in activity`).toBeGreaterThan(0);
      expect(a.lawfulBasis.length, `Empty lawfulBasis in "${a.purpose}"`).toBeGreaterThan(0);
      expect(a.dataCategories.length, `Empty dataCategories in "${a.purpose}"`).toBeGreaterThan(0);
      expect(a.retention.length, `Empty retention in "${a.purpose}"`).toBeGreaterThan(0);
    }
  });
});
