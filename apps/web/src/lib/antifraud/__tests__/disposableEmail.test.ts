import { describe, it, expect } from "vitest";
import domainList from "disposable-email-domains/index.json";
import { isDisposableEmail } from "../disposableEmail";

// Verify the package contains the domains we'll assert on, so we're not
// hardcoding assumptions that could break on package updates.
const knownDisposable = (domainList as string[]).filter((d) =>
  ["mailinator.com", "guerrillamail.com"].includes(d),
);

describe("isDisposableEmail", () => {
  it("both test domains are present in the package list (membership-consistency check)", () => {
    expect(knownDisposable).toContain("mailinator.com");
    expect(knownDisposable).toContain("guerrillamail.com");
  });

  it("returns true for mailinator.com", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
  });

  it("returns true for guerrillamail.com", () => {
    expect(isDisposableEmail("someone@guerrillamail.com")).toBe(true);
  });

  it("returns false for gmail.com (a normal domain)", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
  });

  it("is case-insensitive — Foo@MAILINATOR.COM returns true", () => {
    expect(isDisposableEmail("Foo@MAILINATOR.COM")).toBe(true);
  });

  it("returns false for malformed input with no '@'", () => {
    expect(isDisposableEmail("notanemail")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDisposableEmail("")).toBe(false);
  });

  it("uses the LAST '@' when multiple '@' signs are present (malformed but handled)", () => {
    // 'mailinator.com' after the last '@' should match
    expect(isDisposableEmail("a@b@mailinator.com")).toBe(true);
  });
});
