/**
 * Unit tests for supabaseService — fail-closed invariant.
 *
 * supabaseService reads env vars at module-load time, so each scenario
 * requires vi.resetModules() + a fresh dynamic import to pick up the
 * stubbed environment.
 *
 * vi.mock() is hoisted by Vitest (even with resetModules between tests),
 * so the server-only guard is neutralised for the whole file.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// Both mocks are hoisted — they apply to every dynamic import in this file.
vi.mock("server-only", () => ({}));

const mockCreateClient = vi.fn(() => ({ _isMock: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockCreateClient.mockClear();
});

describe("supabaseService — fail-closed invariant", () => {
  it("returns a SupabaseClient when both env vars are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test");

    const { supabaseService } = await import("@/lib/supabaseService");
    const client = await supabaseService();

    expect(client).toBeDefined();
    expect((client as unknown as Record<string, unknown>)._isMock).toBe(true);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "service-role-key-test",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { supabaseService } = await import("@/lib/supabaseService");

    await expect(supabaseService()).rejects.toThrow(
      "supabaseService: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set",
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test");

    const { supabaseService } = await import("@/lib/supabaseService");

    await expect(supabaseService()).rejects.toThrow(
      "supabaseService: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set",
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("throws when both env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { supabaseService } = await import("@/lib/supabaseService");

    await expect(supabaseService()).rejects.toThrow(
      "supabaseService: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set",
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
