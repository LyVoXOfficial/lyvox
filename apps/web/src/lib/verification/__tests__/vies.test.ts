import { describe, it, expect, vi, afterEach } from "vitest";
import { checkViesVat } from "../vies";

const VALID_BODY = {
  isValid: true,
  name: "Test Company NV",
  address: "Test Street 1, 1000 Brussels",
  requestDate: "2026-06-27",
  requestIdentifier: "",
  vatNumber: "0203201340",
};

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkViesVat", () => {
  it("GET valid body {isValid:true} → outcome:'valid'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(VALID_BODY)));

    const result = await checkViesVat("BE", "0203201340");

    expect(result.outcome).toBe("valid");
    if (result.outcome === "valid") {
      expect(result.name).toBe("Test Company NV");
      expect(result.address).toBe("Test Street 1, 1000 Brussels");
      expect(result.requestDate).toBe("2026-06-27");
      expect(result.requestIdentifier).toBe("");
    }
  });

  it("{isValid:false} → outcome:'invalid'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({
          isValid: false,
          name: "",
          address: "",
          requestDate: "2026-06-27",
        }),
      ),
    );

    const result = await checkViesVat("BE", "0000000000");

    expect(result.outcome).toBe("invalid");
    if (result.outcome === "invalid") {
      expect(result.requestDate).toBe("2026-06-27");
    }
  });

  it("{actionSucceed:false, errorWrappers:[{error:'MS_UNAVAILABLE'}]} → outcome:'unavailable'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({
          actionSucceed: false,
          errorWrappers: [{ error: "MS_UNAVAILABLE" }],
        }),
      ),
    );

    const result = await checkViesVat("BE", "0203201340");

    expect(result.outcome).toBe("unavailable");
    if (result.outcome === "unavailable") {
      expect(result.error).toBe("MS_UNAVAILABLE");
    }
  });

  it("{actionSucceed:false, errorWrappers:[{error:'INVALID_INPUT'}]} → outcome:'bad_input'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse({
          actionSucceed: false,
          errorWrappers: [{ error: "INVALID_INPUT" }],
        }),
      ),
    );

    const result = await checkViesVat("BE", "BADVAL");

    expect(result.outcome).toBe("bad_input");
    if (result.outcome === "bad_input") {
      expect(result.error).toBe("INVALID_INPUT");
    }
  });

  it("non-2xx HTTP response → outcome:'unavailable' with HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse({}, 503)));

    const result = await checkViesVat("BE", "0203201340");

    expect(result.outcome).toBe("unavailable");
    if (result.outcome === "unavailable") {
      expect(result.error).toBe("HTTP_503");
    }
  });

  it("aborted fetch (AbortError) → outcome:'unavailable', error:'TIMEOUT'", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await checkViesVat("BE", "0203201340");

    expect(result.outcome).toBe("unavailable");
    if (result.outcome === "unavailable") {
      expect(result.error).toBe("TIMEOUT");
    }
  });

  it("plain network error → outcome:'unavailable', error:'NETWORK'", async () => {
    const networkError = new Error("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    const result = await checkViesVat("BE", "0203201340");

    expect(result.outcome).toBe("unavailable");
    if (result.outcome === "unavailable") {
      expect(result.error).toBe("NETWORK");
    }
  });
});
