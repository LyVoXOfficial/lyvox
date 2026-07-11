import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "apps", "web", "src", "app");
const FORBIDDEN_SEGMENTS = new Set([
  "debug",
  "dev-tools",
  "playground",
  "test-auth",
]);

function collectProductionRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return collectProductionRoutes(absolutePath);
    }

    if (entry.name !== "page.tsx" && entry.name !== "route.ts") return [];
    return [relative(APP_ROOT, absolutePath).split(sep).join("/")];
  });
}

describe("production route exposure", () => {
  it("does not ship diagnostic, playground, or test-only routes", () => {
    const exposedRoutes = collectProductionRoutes(APP_ROOT).filter((route) =>
      route
        .split("/")
        .some((segment) => FORBIDDEN_SEGMENTS.has(segment.toLowerCase())),
    );

    expect(exposedRoutes).toEqual([]);
  });
});
