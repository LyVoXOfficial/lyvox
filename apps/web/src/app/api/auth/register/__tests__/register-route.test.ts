import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

const signUpMock = vi.fn();
const profileUpsertMock = vi.fn();
const logInsertMock = vi.fn();
let serviceShouldThrow = false;

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
    expect(body).toMatchObject({ ok: true, verificationRequired: true });
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
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_EMAIL" });
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

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "PROFILE_UPSERT_FAILED" });
    expect(logInsertMock).not.toHaveBeenCalled();
  });
});
