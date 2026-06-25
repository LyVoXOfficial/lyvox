import { describe, it, expect } from "vitest";
import { hasAdminRole } from "@/lib/adminRole";

describe("hasAdminRole", () => {
  // SECURITY REGRESSION GUARD (see docs/SECURITY_AUDIT.md C1):
  // `user_metadata` is writable by the user via auth.updateUser({ data: ... }),
  // so it must NEVER grant admin. Only `app_metadata` (service-role-only) may.
  it("does NOT grant admin from user_metadata.role (privilege-escalation guard)", () => {
    expect(hasAdminRole({ user_metadata: { role: "admin" } })).toBe(false);
    expect(hasAdminRole({ user_metadata: { roles: ["admin"] } })).toBe(false);
  });

  it("grants admin from app_metadata.role", () => {
    expect(hasAdminRole({ app_metadata: { role: "admin" } })).toBe(true);
  });

  it("grants admin from app_metadata.roles array", () => {
    expect(hasAdminRole({ app_metadata: { roles: ["user", "admin"] } })).toBe(true);
  });

  it("is case-insensitive on the role value", () => {
    expect(hasAdminRole({ app_metadata: { role: "Admin" } })).toBe(true);
  });

  it("returns false for non-admin / empty / nullish inputs", () => {
    expect(hasAdminRole({ app_metadata: { role: "user" } })).toBe(false);
    expect(hasAdminRole({ app_metadata: {} })).toBe(false);
    expect(hasAdminRole({})).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
    expect(hasAdminRole(undefined)).toBe(false);
  });

  it("ignores a non-admin app_metadata even when user_metadata claims admin", () => {
    expect(
      hasAdminRole({
        app_metadata: { role: "user" },
        user_metadata: { role: "admin" },
      }),
    ).toBe(false);
  });
});
