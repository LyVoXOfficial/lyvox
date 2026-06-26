import { describe, it, expect } from "vitest";
import { createBusinessSchema } from "../business";

// Valid KBO numbers from spec: NBB 0203201340, InBev 0417497106
const VALID_KBO = "0203201340";
const VALID_VAT = "0203201340"; // Belgian VAT digits == KBO digits
const VALID_KBO_2 = "0417497106";

const BASE_VALID: Record<string, unknown> = {
  legal_name: "Test Bedrijf BV",
  kbo_number: VALID_KBO,
  vat_liable: false,
  address_line: "Teststraat 1",
  postcode: "1000",
  city: "Brussel",
  country: "BE",
  email: "info@testbedrijf.be",
  withdrawal_terms: "14 calendar days right of withdrawal per Belgian consumer law.",
  self_certified: true,
};

describe("createBusinessSchema", () => {
  describe("valid body passes", () => {
    it("passes a minimal valid body (not vat_liable)", () => {
      const result = createBusinessSchema.safeParse(BASE_VALID);
      expect(result.success).toBe(true);
    });

    it("passes with vat_liable:true and a valid vat_number", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        vat_liable: true,
        vat_number: VALID_VAT,
      });
      expect(result.success).toBe(true);
    });

    it("passes with optional fields present", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        trade_name: "Test Trading",
        legal_form: "BV/SRL",
        phone_e164: "+32470123456",
        vat_liable: true,
        vat_number: VALID_KBO_2,
        kbo_number: VALID_KBO_2,
      });
      expect(result.success).toBe(true);
    });

    it("defaults country to BE when omitted", () => {
      const body = { ...BASE_VALID };
      delete body.country;
      const result = createBusinessSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe("BE");
      }
    });
  });

  describe("vat_liable cross-field validation", () => {
    it("fails when vat_liable:true and vat_number is missing", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        vat_liable: true,
        // no vat_number
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("vat_number");
      }
    });

    it("fails when vat_liable:true and vat_number has bad checksum", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        vat_liable: true,
        vat_number: "0203201341", // last digit wrong
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("vat_number");
      }
    });

    it("passes when vat_liable:false and vat_number is omitted", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        vat_liable: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("kbo_number validation", () => {
    it("fails on bad KBO checksum", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        kbo_number: "0203201341", // last digit wrong
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("kbo_number");
      }
    });

    it("fails on wrong length", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        kbo_number: "020320134", // 9 digits
      });
      expect(result.success).toBe(false);
    });

    it("fails on leading digit not 0 or 1", () => {
      // 2xxxxxxxxx - wrong leading digit; checksum won't matter
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        kbo_number: "2203201340",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("postcode validation", () => {
    it("fails on postcode starting with 0", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        postcode: "0123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("postcode");
      }
    });

    it("fails on 3-digit postcode", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        postcode: "123",
      });
      expect(result.success).toBe(false);
    });

    it("fails on 5-digit postcode", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        postcode: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("passes on valid Belgian postcodes", () => {
      for (const pc of ["1000", "9999", "1234"]) {
        const result = createBusinessSchema.safeParse({ ...BASE_VALID, postcode: pc });
        expect(result.success, `postcode ${pc} should pass`).toBe(true);
      }
    });
  });

  describe("self_certified validation", () => {
    it("fails when self_certified is false", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        self_certified: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("self_certified");
      }
    });

    it("fails when self_certified is missing", () => {
      const body = { ...BASE_VALID };
      delete body.self_certified;
      const result = createBusinessSchema.safeParse(body);
      expect(result.success).toBe(false);
    });
  });

  describe("other field validations", () => {
    it("fails on missing legal_name", () => {
      const body = { ...BASE_VALID };
      delete body.legal_name;
      const result = createBusinessSchema.safeParse(body);
      expect(result.success).toBe(false);
    });

    it("fails on invalid email", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("fails on withdrawal_terms exceeding 2000 chars", () => {
      const result = createBusinessSchema.safeParse({
        ...BASE_VALID,
        withdrawal_terms: "a".repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });
});
