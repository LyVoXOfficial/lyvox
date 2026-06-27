import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

const signUpMock = vi.fn();
const profileUpsertMock = vi.fn();
const logInsertMock = vi.fn();
let serviceShouldThrow = false;

// Mock verifyTurnstile — default to ok so existing tests are unaffected.
// Tests that need it to fail override verifyTurnstileMock in the test body.
const verifyTurnstileMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: () => ({
    auth: {
      signUp: signUpMock,
    },
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: () => {
    if (serviceShouldThrow) {
      throw new Error("service role missing");
    }

    return {
      from(table: string) {
        if (table === "profiles") {
          return {
            upsert: profileUpsertMock,
          };
        }
        if (table === "logs") {
          return {
            insert: logInsertMock,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };
  },
}));

vi.mock("@/lib/antifraud/turnstile", () => ({
  verifyTurnstile: verifyTurnstileMock,
}));

const { POST } = await import("../route");

const defaultPayload = {
  email: "user@example.com",
  password: "Password!123",
  confirmPassword: "Password!123",
  consents: {
    terms: true,
    privacy: true,
    marketing: false,
  },
};

beforeEach(() => {
  signUpMock.mockReset();
  profileUpsertMock.mockReset();
  logInsertMock.mockReset();
  serviceShouldThrow = false;
  // Default: Turnstile returns ok (simulates no-secret / skipped path)
  verifyTurnstileMock.mockResolvedValue({ ok: true, skipped: true });
});

afterEach(() => {
  serviceShouldThrow = false;
});

describe("POST /api/auth/register", () => {
  it("registers a user and logs consent metadata", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: null } },
      error: null,
    });
    profileUpsertMock.mockResolvedValue({ error: null });
    logInsertMock.mockResolvedValue({ error: null });

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify(defaultPayload),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { verificationRequired: true } });
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        password: "Password!123",
      }),
    );
    expect(profileUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
      }),
    );
    expect(logInsertMock).toHaveBeenCalled();
  });

  it("rejects invalid email payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...defaultPayload, email: "bad-email" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: "INVALID_PAYLOAD" });
    expect(body.detail).toContain("Validation failed");
    expect(body.detail).toContain("email");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns an error when service role is missing", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: null } },
      error: null,
    });
    profileUpsertMock.mockResolvedValue({ error: null });
    serviceShouldThrow = true;

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify(defaultPayload),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "SERVICE_ROLE_MISSING" });
    expect(logInsertMock).not.toHaveBeenCalled();
  });

  it("propagates profile upsert failures", async () => {
    const upsertError: PostgrestError = {
      name: "PostgrestError",
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "profiles_pkey",
      hint: "",
    };

    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: null } },
      error: null,
    });
    profileUpsertMock.mockResolvedValue({ error: upsertError });

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify(defaultPayload),
      }),
    );

    // UNIQUE constraint violation (23505) теперь возвращает 409 с BAD_INPUT кодом
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "BAD_INPUT" });
    expect(logInsertMock).not.toHaveBeenCalled();
  });

  // ── T3 guard tests ──────────────────────────────────────────────────────────

  it("rejects disposable email addresses with 400 DISPOSABLE_EMAIL (signUp not called)", async () => {
    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...defaultPayload, email: "x@mailinator.com" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: "DISPOSABLE_EMAIL" });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("succeeds when TURNSTILE_SECRET_KEY is unset (Turnstile skipped — happy path unchanged)", async () => {
    // verifyTurnstileMock already returns { ok: true, skipped: true } by default (see beforeEach)
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-2", email_confirmed_at: null } },
      error: null,
    });
    profileUpsertMock.mockResolvedValue({ error: null });
    logInsertMock.mockResolvedValue({ error: null });

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify(defaultPayload),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { verificationRequired: true } });
    expect(signUpMock).toHaveBeenCalled();
  });

  it("returns 403 CAPTCHA_FAILED when verifyTurnstile fails", async () => {
    verifyTurnstileMock.mockResolvedValue({ ok: false, codes: ["invalid-input-response"] });

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...defaultPayload, turnstileToken: "bad-token" }),
      }),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, error: "CAPTCHA_FAILED" });
    expect(body.detail).toBe("invalid-input-response");
    expect(signUpMock).not.toHaveBeenCalled();
  });
});
