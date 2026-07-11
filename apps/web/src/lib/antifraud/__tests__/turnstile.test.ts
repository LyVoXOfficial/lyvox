import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTurnstile } from "../turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("(a) no TURNSTILE_SECRET_KEY → returns {ok:true, skipped:true} and fetch is NOT called", async () => {
    // Ensure the env var is absent.
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await verifyTurnstile("some-token");

    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(b) secret set + success:true → {ok:true}", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, "error-codes": [] }),
      }),
    );

    const result = await verifyTurnstile("valid-token", "1.2.3.4");

    expect(result).toEqual({ ok: true });
  });

  it("(c) secret set + success:false → {ok:false, codes:[...]}", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      }),
    );

    const result = await verifyTurnstile("bad-token");

    expect(result).toEqual({ ok: false, codes: ["invalid-input-response"] });
  });

  it("(d) secret set + no token → {ok:false, codes:['missing-input-response']} and fetch NOT called", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const resultNull = await verifyTurnstile(null);
    const resultUndefined = await verifyTurnstile(undefined);

    expect(resultNull).toEqual({
      ok: false,
      codes: ["missing-input-response"],
    });
    expect(resultUndefined).toEqual({
      ok: false,
      codes: ["missing-input-response"],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(e) secret set + fetch throws → {ok:false, codes:['internal-error']}", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure")),
    );

    const result = await verifyTurnstile("some-token");

    expect(result).toEqual({ ok: false, codes: ["internal-error"] });
  });

  it("non-ok HTTP response → {ok:false, codes:['internal-error']}", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const result = await verifyTurnstile("some-token");

    expect(result).toEqual({ ok: false, codes: ["internal-error"] });
  });

  it("remoteip is included in request when ip is provided", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await verifyTurnstile("token", "10.0.0.1");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain("remoteip=10.0.0.1");
  });

  it("fails closed without a secret when the caller marks Turnstile required", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await verifyTurnstile("some-token", null, {
      required: true,
    });

    expect(result).toEqual({ ok: false, codes: ["missing-input-secret"] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects tokens larger than Cloudflare's documented limit without a network call", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await verifyTurnstile("x".repeat(2_049));

    expect(result).toEqual({
      ok: false,
      codes: ["invalid-input-response"],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires the expected action and hostname when supplied", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        action: "access_gate_unlock",
        hostname: "www.lyvox.be",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      verifyTurnstile("token", null, {
        required: true,
        expectedAction: "access_gate_unlock",
        expectedHostname: "www.lyvox.be",
      }),
    ).resolves.toEqual({ ok: true });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        action: "register",
        hostname: "www.lyvox.be",
      }),
    });
    await expect(
      verifyTurnstile("token", null, {
        expectedAction: "access_gate_unlock",
        expectedHostname: "www.lyvox.be",
      }),
    ).resolves.toEqual({ ok: false, codes: ["action-mismatch"] });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        action: "access_gate_unlock",
        hostname: "evil.example",
      }),
    });
    await expect(
      verifyTurnstile("token", null, {
        expectedAction: "access_gate_unlock",
        expectedHostname: "www.lyvox.be",
      }),
    ).resolves.toEqual({ ok: false, codes: ["hostname-mismatch"] });
  });
});
