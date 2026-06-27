import { describe, it, expect } from "vitest";
import { deriveSellerBadges } from "@/lib/profile/sellerBadges";

// Fixed "now" for deterministic date math
// 2026-06-27T00:00:00.000Z
const NOW = new Date("2026-06-27T00:00:00.000Z");

// Helpers — produce a createdAt string relative to NOW
function monthsAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString();
}

describe("deriveSellerBadges", () => {
  describe("business seller — verified + VAT", () => {
    it("includes verified_business first, then vat_registered", () => {
      const badges = deriveSellerBadges({
        sellerType: "business",
        verifiedEmail: true,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: true,
        hasVat: true,
        createdAt: monthsAgo(24),
        activeListings: 5,
        now: NOW,
      });
      expect(badges).toContain("verified_business");
      expect(badges).toContain("vat_registered");
      expect(badges.indexOf("verified_business")).toBeLessThan(
        badges.indexOf("vat_registered"),
      );
    });

    it("does not include vat_registered when entity is not verified", () => {
      const badges = deriveSellerBadges({
        sellerType: "business",
        verifiedEmail: true,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: false,
        hasVat: true,
        createdAt: monthsAgo(24),
        activeListings: 5,
        now: NOW,
      });
      expect(badges).not.toContain("verified_business");
      expect(badges).not.toContain("vat_registered");
    });
  });

  describe("private seller — phone_verified + old account + listings", () => {
    it("includes phone_verified and established_seller", () => {
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: false,
        verifiedPhone: true,
        idVerified: false,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(18),
        activeListings: 3,
        now: NOW,
      });
      expect(badges).toContain("phone_verified");
      expect(badges).toContain("established_seller");
    });
  });

  describe("cap at 3", () => {
    it("returns exactly 3 badges when seller earns 5 or more", () => {
      // An individual who has: id_verified, phone_verified, email_verified, established_seller
      // (4 badges earned — capped to 3)
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: true,
        verifiedPhone: true,
        idVerified: true,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(15),
        activeListings: 2,
        now: NOW,
      });
      expect(badges.length).toBe(3);
    });

    it("returns the first 3 in precedence order when capped", () => {
      // Earns: id_verified (tier1), phone_verified (tier2), established_seller (tier3), email_verified (tier3)
      // Precedence order: id_verified → phone_verified → established_seller → email_verified
      // Capped to 3: [id_verified, phone_verified, established_seller]
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: true,
        verifiedPhone: true,
        idVerified: true,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(13),
        activeListings: 1,
        now: NOW,
      });
      expect(badges).toEqual(["id_verified", "phone_verified", "established_seller"]);
    });

    it("business seller who earns 5 badges returns exactly 3", () => {
      // Earns: id_verified, verified_business, vat_registered, phone_verified, established_seller (5 badges)
      const badges = deriveSellerBadges({
        sellerType: "business",
        verifiedEmail: true,
        verifiedPhone: true,
        idVerified: true,
        entityVerified: true,
        hasVat: true,
        createdAt: monthsAgo(24),
        activeListings: 10,
        now: NOW,
      });
      expect(badges.length).toBe(3);
      // First 3 in precedence: id_verified, verified_business, vat_registered
      expect(badges).toEqual(["id_verified", "verified_business", "vat_registered"]);
    });
  });

  describe("established_seller threshold boundary", () => {
    it("11 months ago is NOT established (below threshold)", () => {
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: false,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(11),
        activeListings: 5,
        now: NOW,
      });
      expect(badges).not.toContain("established_seller");
    });

    it("13 months ago + 1 listing IS established", () => {
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: false,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(13),
        activeListings: 1,
        now: NOW,
      });
      expect(badges).toContain("established_seller");
    });

    it("13 months ago + 0 listings is NOT established", () => {
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: false,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: false,
        hasVat: false,
        createdAt: monthsAgo(13),
        activeListings: 0,
        now: NOW,
      });
      expect(badges).not.toContain("established_seller");
    });

    it("null createdAt is NOT established", () => {
      const badges = deriveSellerBadges({
        sellerType: "individual",
        verifiedEmail: false,
        verifiedPhone: false,
        idVerified: false,
        entityVerified: false,
        hasVat: false,
        createdAt: null,
        activeListings: 5,
        now: NOW,
      });
      expect(badges).not.toContain("established_seller");
    });
  });
});
