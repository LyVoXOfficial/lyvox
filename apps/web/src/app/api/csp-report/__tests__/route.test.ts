import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("@/lib/errorLogger", () => ({
  logger: { warn: mocks.warn },
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => vi.fn(),
  getClientIp: () => "203.0.113.10",
  withRateLimit: (handler: (request: Request) => Promise<Response>) => handler,
}));

import { POST } from "../route";

function reportRequest(body: string, contentType = "application/csp-report") {
  return new Request("https://www.lyvox.be/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("POST /api/csp-report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs only a bounded allowlist and strips URL queries and script samples", async () => {
    const response = await POST(
      reportRequest(
        JSON.stringify({
          "csp-report": {
            "document-uri": "https://www.lyvox.be/search?token=secret#private",
            "blocked-uri": "https://evil.test/script.js?credential=secret",
            "effective-directive": "script-src-elem",
            "script-sample": "sensitive inline source",
            "line-number": 12,
          },
        }),
      ),
    );

    expect(response.status).toBe(204);
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(mocks.warn.mock.calls[0]);
    expect(serialized).toContain("https://www.lyvox.be/search");
    expect(serialized).toContain("https://evil.test/script.js");
    expect(serialized).not.toContain("token=secret");
    expect(serialized).not.toContain("credential=secret");
    expect(serialized).not.toContain("sensitive inline source");
  });

  it("drops oversized chunked bodies before logging", async () => {
    const response = await POST(reportRequest("x".repeat(8 * 1024 + 1)));

    expect(response.status).toBe(204);
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it("never echoes malformed attacker-controlled text into logs", async () => {
    const response = await POST(reportRequest("not-json-secret"));

    expect(response.status).toBe(204);
    expect(JSON.stringify(mocks.warn.mock.calls[0])).not.toContain(
      "not-json-secret",
    );
  });

  it("ignores unsupported media types", async () => {
    const response = await POST(reportRequest("secret", "text/plain"));

    expect(response.status).toBe(204);
    expect(mocks.warn).not.toHaveBeenCalled();
  });
});
