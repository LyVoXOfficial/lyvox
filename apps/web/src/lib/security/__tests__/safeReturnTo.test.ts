import { describe, expect, it } from "vitest";
import { sanitizeInternalReturnTo } from "../safeReturnTo";

describe("sanitizeInternalReturnTo", () => {
  it.each([
    ["/profile", "/profile"],
    ["/search?q=bike#results", "/search?q=bike#results"],
    ["/nl/profile", "/nl/profile"],
  ])("keeps a same-origin path", (value, expected) => {
    expect(sanitizeInternalReturnTo(value, "/fallback")).toBe(expected);
  });

  it.each([
    "https://evil.test/phish",
    "//evil.test/phish",
    "/\\evil.test/phish",
    "/%2fevil.test/phish",
    "/%5cevil.test/phish",
    "/foo/..//evil.test/phish",
    "javascript:alert(1)",
    "\n/profile",
  ])("rejects an external or ambiguous target", (value) => {
    expect(sanitizeInternalReturnTo(value, "/fallback")).toBe("/fallback");
  });

  it("rejects absent and oversized values", () => {
    expect(sanitizeInternalReturnTo(null, "/fallback")).toBe("/fallback");
    expect(sanitizeInternalReturnTo(`/${"a".repeat(2_048)}`, "/fallback")).toBe(
      "/fallback",
    );
  });
});
