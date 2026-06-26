import { describe, it, expect } from "vitest";
import { normalizeKbo, isValidKbo, isValidBelgianVat } from "../kbo";

describe("normalizeKbo", () => {
  it("strips dots and spaces", () => {
    expect(normalizeKbo("0203.201.340")).toBe("0203201340");
    expect(normalizeKbo("0203 201 340")).toBe("0203201340");
  });

  it("strips BE prefix", () => {
    expect(normalizeKbo("BE0203201340")).toBe("0203201340");
    expect(normalizeKbo("be0203201340")).toBe("0203201340");
  });

  it("returns null for empty/null/undefined", () => {
    expect(normalizeKbo("")).toBeNull();
    expect(normalizeKbo(null)).toBeNull();
    expect(normalizeKbo(undefined)).toBeNull();
  });

  it("returns bare digits as-is", () => {
    expect(normalizeKbo("0203201340")).toBe("0203201340");
  });
});

describe("isValidKbo", () => {
  it("accepts valid enterprise number NBB 0203201340", () => {
    // base=02032013, 02032013 mod 97=57, 97-57=40 → check=40 ✓
    expect(isValidKbo("0203201340")).toBe(true);
  });

  it("accepts valid enterprise number InBev 0417497106", () => {
    // base=04174971, 04174971 mod 97=91, 97-91=6 → check=06 ✓
    expect(isValidKbo("0417497106")).toBe(true);
  });

  it("accepts input with BE prefix and dots", () => {
    expect(isValidKbo("BE0203.201.340")).toBe(true);
  });

  it("rejects invalid checksum", () => {
    // change last two digits to 99 (wrong)
    expect(isValidKbo("0203201399")).toBe(false);
  });

  it("rejects wrong length (9 digits)", () => {
    expect(isValidKbo("020320134")).toBe(false);
  });

  it("rejects leading digit other than 0 or 1", () => {
    // construct a number starting with 2
    expect(isValidKbo("2203201340")).toBe(false);
  });

  it("accepts leading digit 1", () => {
    // 1-series number: construct one with correct checksum
    // base=10000000, 10000000 mod 97=9, 97-9=88 → "1000000088"
    const base = 10000000;
    const check = 97 - (base % 97); // = 97 - 9 = 88
    const num = `${base}${String(check).padStart(2, "0")}`;
    expect(isValidKbo(num)).toBe(true);
  });
});

describe("isValidBelgianVat", () => {
  it("is equivalent to isValidKbo on 10-digit base", () => {
    expect(isValidBelgianVat("0203201340")).toBe(isValidKbo("0203201340"));
    expect(isValidBelgianVat("0203201399")).toBe(isValidKbo("0203201399"));
  });

  it("accepts BE-prefixed VAT number", () => {
    expect(isValidBelgianVat("BE0203201340")).toBe(true);
  });
});
