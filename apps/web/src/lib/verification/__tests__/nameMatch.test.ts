import { describe, it, expect } from "vitest";
import { normalizeLegalName, legalNameMatches } from "../nameMatch";

describe("normalizeLegalName", () => {
  it("lowercases everything", () => {
    expect(normalizeLegalName("ACME")).toBe("acme");
  });

  it("strips trailing NV suffix", () => {
    expect(normalizeLegalName("Acme NV")).toBe("acme");
  });

  it("strips leading NV suffix (prefix position)", () => {
    expect(normalizeLegalName("NV Anheuser-Busch InBev")).toBe("anheuser-busch inbev");
  });

  it("strips SA suffix", () => {
    expect(normalizeLegalName("TotalEnergies SA")).toBe("totalenergies");
  });

  it("strips BV suffix", () => {
    expect(normalizeLegalName("Acme BV")).toBe("acme");
  });

  it("strips SRL suffix", () => {
    expect(normalizeLegalName("Acme SRL")).toBe("acme");
  });

  it("strips BVBA suffix", () => {
    expect(normalizeLegalName("Acme BVBA")).toBe("acme");
  });

  it("strips SPRL suffix", () => {
    expect(normalizeLegalName("Acme SPRL")).toBe("acme");
  });

  it("strips VZW suffix", () => {
    expect(normalizeLegalName("Acme VZW")).toBe("acme");
  });

  it("strips ASBL suffix", () => {
    expect(normalizeLegalName("Acme ASBL")).toBe("acme");
  });

  it("collapses multiple whitespace", () => {
    expect(normalizeLegalName("Foo   Bar")).toBe("foo bar");
  });

  it("strips punctuation (commas, dots, parens)", () => {
    expect(normalizeLegalName("Foo, Bar.")).toBe("foo bar");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeLegalName("  Acme  ")).toBe("acme");
  });
});

describe("legalNameMatches", () => {
  it("matches same name different case", () => {
    expect(legalNameMatches("Acme NV", "ACME nv")).toBe(true);
  });

  it("suffix-strip makes Acme BV match acme", () => {
    expect(legalNameMatches("Acme BV", "acme")).toBe(true);
  });

  it("VIES prefix NV case: NV Anheuser-Busch InBev matches Anheuser-Busch InBev NV", () => {
    expect(legalNameMatches("NV Anheuser-Busch InBev", "Anheuser-Busch InBev NV")).toBe(true);
  });

  it("returns false for clearly different names", () => {
    expect(legalNameMatches("Acme BV", "Totally Different Company")).toBe(false);
  });

  it("whitespace differences are normalized", () => {
    expect(legalNameMatches("Foo  Bar  BV", "foo bar")).toBe(true);
  });

  it("punctuation differences are normalized", () => {
    expect(legalNameMatches("Foo, Bar.", "foo bar")).toBe(true);
  });
});
