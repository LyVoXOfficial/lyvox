import { describe, it, expect } from "vitest";
import { parseBelgianMobile } from "../belgianPhone";

// All fixtures below were verified empirically against libphonenumber-js/max
// (the metadata bundle the implementation imports). A valid Belgian mobile is
// +32 followed by 9 national digits (e.g. +32470123456 == national 0470123456).
describe("parseBelgianMobile", () => {
  it("accepts a valid BE mobile in +32 international form", () => {
    expect(parseBelgianMobile("+32470123456")).toEqual({
      ok: true,
      e164: "+32470123456",
    });
  });

  it("accepts a valid BE mobile in national 0470 form", () => {
    expect(parseBelgianMobile("0470123456")).toEqual({
      ok: true,
      e164: "+32470123456",
    });
  });

  it("accepts a valid BE mobile in 0032 form", () => {
    expect(parseBelgianMobile("0032470123456")).toEqual({
      ok: true,
      e164: "+32470123456",
    });
  });

  it("normalizes +32, national 0470 and 0032 forms to the same E.164", () => {
    const intl = parseBelgianMobile("+32470123456");
    const national = parseBelgianMobile("0470123456");
    const zeroZero = parseBelgianMobile("0032470123456");
    expect(intl.ok && national.ok && zeroZero.ok).toBe(true);
    if (intl.ok && national.ok && zeroZero.ok) {
      expect(national.e164).toBe(intl.e164);
      expect(zeroZero.e164).toBe(intl.e164);
    }
  });

  it("rejects a BE landline as not_mobile (Brussels 02 in +32 form)", () => {
    expect(parseBelgianMobile("+3225114000")).toEqual({
      ok: false,
      reason: "not_mobile",
    });
  });

  it("rejects a BE landline as not_mobile (national 02 form)", () => {
    expect(parseBelgianMobile("025114000")).toEqual({
      ok: false,
      reason: "not_mobile",
    });
  });

  it("rejects a valid non-BE number as not_be (FR mobile)", () => {
    expect(parseBelgianMobile("+33612345678")).toEqual({
      ok: false,
      reason: "not_be",
    });
  });

  it("rejects garbage input as format", () => {
    expect(parseBelgianMobile("garbage")).toEqual({
      ok: false,
      reason: "format",
    });
  });

  it("rejects an empty string as format", () => {
    expect(parseBelgianMobile("")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects a too-short number as format", () => {
    expect(parseBelgianMobile("12345")).toEqual({
      ok: false,
      reason: "format",
    });
  });
});
