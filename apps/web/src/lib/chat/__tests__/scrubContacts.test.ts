import { describe, it, expect } from "vitest";
import { scrubContacts, MASK } from "@/lib/chat/scrubContacts";

describe("scrubContacts", () => {
  it("leaves ordinary marketplace chatter untouched", () => {
    const r = scrubContacts("Hi! Is the bike still available? I can offer 150 euros, size 42.");
    expect(r.flagged).toBe(false);
    expect(r.types).toEqual([]);
    expect(r.cleaned).toBe("Hi! Is the bike still available? I can offer 150 euros, size 42.");
  });

  it("does NOT flag short numbers like prices or sizes (fewer than 8 digits)", () => {
    const r = scrubContacts("price 1500, ref 2024, size 42");
    expect(r.flagged).toBe(false);
  });

  it("masks a Belgian phone number with separators", () => {
    const r = scrubContacts("call me on 0470 12 34 56 to arrange");
    expect(r.flagged).toBe(true);
    expect(r.types).toContain("phone");
    expect(r.cleaned).not.toContain("0470");
    expect(r.cleaned).toContain(MASK);
  });

  it("masks a compact international phone number", () => {
    const r = scrubContacts("whatsapp +32470123456");
    expect(r.types).toContain("phone");
    expect(r.cleaned).not.toContain("32470123456");
  });

  it("masks an email address", () => {
    const r = scrubContacts("reach me at john.doe@gmail.com please");
    expect(r.types).toContain("email");
    expect(r.cleaned).not.toContain("john.doe@gmail.com");
    expect(r.cleaned).toContain(MASK);
  });

  it("masks external URLs", () => {
    const r = scrubContacts("pay here https://lyvox-secure.pay/confirm now");
    expect(r.types).toContain("url");
    expect(r.cleaned).not.toContain("https://lyvox-secure.pay/confirm");
  });

  it("masks www links without scheme", () => {
    const r = scrubContacts("see www.scam-courier.example/track");
    expect(r.types).toContain("url");
    expect(r.cleaned).not.toContain("www.scam-courier.example");
  });

  it("does NOT mask allowlisted technical reference URLs", () => {
    const url = "https://www.realoem.com/bmw/enUS/part?id=123";
    const r = scrubContacts(`part specs are here ${url}`);
    expect(r.flagged).toBe(false);
    expect(r.types).toEqual([]);
    expect(r.cleaned).toContain(url);
  });

  it("masks contact-channel URLs even when they look short and legitimate", () => {
    const r = scrubContacts("message me at https://wa.me/32470123456");
    expect(r.types).toContain("url");
    expect(r.cleaned).not.toContain("wa.me");
    expect(r.cleaned).toContain(MASK);
  });

  it("masks malformed URLs without throwing", () => {
    expect(() => scrubContacts("broken link https://[bad]")).not.toThrow();
    const r = scrubContacts("broken link https://[bad]");
    expect(r.types).toContain("url");
    expect(r.cleaned).toContain(MASK);
  });

  it("masks an IBAN (with or without spaces)", () => {
    const r = scrubContacts("transfer to BE68 5390 0754 7034 thanks");
    expect(r.types).toContain("iban");
    expect(r.cleaned).not.toContain("5390");
  });

  it("masks a dash-separated phone number", () => {
    const r = scrubContacts("ring 0470-12-34-56 tonight");
    expect(r.types).toContain("phone");
    expect(r.cleaned).not.toContain("0470-12-34-56");
  });

  it("does NOT mask a contiguous IMEI (legit in electronics chat)", () => {
    const r = scrubContacts("the IMEI is 353915105763890, check it's not blacklisted");
    expect(r.flagged).toBe(false);
    expect(r.cleaned).toContain("353915105763890");
  });

  it("does NOT mask a contiguous EAN/serial barcode", () => {
    const r = scrubContacts("EAN 5410012345678 / serial 0123456789");
    expect(r.flagged).toBe(false);
    expect(r.cleaned).toContain("5410012345678");
  });

  it("masks multiple contact types in one message and dedupes types", () => {
    const r = scrubContacts("email a@b.com or call 0470 12 34 56 or 0470 12 34 56");
    expect(r.flagged).toBe(true);
    expect(r.types).toEqual(expect.arrayContaining(["email", "phone"]));
    // types are unique
    expect(new Set(r.types).size).toBe(r.types.length);
  });

  it("handles empty / whitespace input safely", () => {
    expect(scrubContacts("").flagged).toBe(false);
    expect(scrubContacts("   ").cleaned).toBe("   ");
  });

  it("does not treat the IBAN digits as a phone number (no double mask)", () => {
    const r = scrubContacts("BE68 5390 0754 7034");
    // exactly one type detected, not phone too
    expect(r.types).toEqual(["iban"]);
  });
});
