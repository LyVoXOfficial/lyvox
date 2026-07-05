import { describe, it, expect, vi } from "vitest";
import { assertSameOrigin, withCsrfProtection } from "@/lib/security/csrf";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://www.lyvox.be/api/whatever", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin", () => {
  it("allows a same-origin request (Origin matches Host)", () => {
    const req = makeRequest({ origin: "https://www.lyvox.be", host: "www.lyvox.be" });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("allows a same-origin request behind x-forwarded-host (Vercel)", () => {
    const req = makeRequest({
      origin: "https://www.lyvox.be",
      host: "internal-lb.vercel.internal",
      "x-forwarded-host": "www.lyvox.be",
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("rejects a cross-site Origin", () => {
    const req = makeRequest({ origin: "https://evil.example", host: "www.lyvox.be" });
    const result = assertSameOrigin(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("rejects a malformed Origin header", () => {
    const req = makeRequest({ origin: "not-a-url", host: "www.lyvox.be" });
    const result = assertSameOrigin(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("falls back to Sec-Fetch-Site when Origin is absent: rejects cross-site", () => {
    const req = makeRequest({ host: "www.lyvox.be", "sec-fetch-site": "cross-site" });
    const result = assertSameOrigin(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("falls back to Sec-Fetch-Site when Origin is absent: allows same-origin", () => {
    const req = makeRequest({ host: "www.lyvox.be", "sec-fetch-site": "same-origin" });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("falls back to Sec-Fetch-Site when Origin is absent: allows same-site", () => {
    const req = makeRequest({ host: "www.lyvox.be", "sec-fetch-site": "same-site" });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("allows requests with neither Origin nor Sec-Fetch-Site (non-browser callers)", () => {
    const req = makeRequest({ host: "www.lyvox.be" });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it("body of the rejection follows the {ok:false,error} envelope", async () => {
    const req = makeRequest({ origin: "https://evil.example", host: "www.lyvox.be" });
    const result = assertSameOrigin(req)!;
    const body = await result.json();
    expect(body).toMatchObject({ ok: false, error: "CSRF_ORIGIN_MISMATCH" });
  });
});

describe("withCsrfProtection", () => {
  it("short-circuits the wrapped handler on a cross-site request", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withCsrfProtection(handler);
    const req = makeRequest({ origin: "https://evil.example", host: "www.lyvox.be" });

    const res = await wrapped(req);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it("calls through to the wrapped handler on a same-origin request", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withCsrfProtection(handler);
    const req = makeRequest({ origin: "https://www.lyvox.be", host: "www.lyvox.be" });

    const res = await wrapped(req);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
