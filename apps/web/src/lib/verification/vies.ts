// apps/web/src/lib/verification/vies.ts  — server-only. No key required.
const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api";

export type ViesResult =
  | { outcome: "valid"; name: string; address: string; requestIdentifier: string; requestDate: string }
  | { outcome: "invalid"; requestDate: string }
  | { outcome: "unavailable"; error: string }   // transient → retry/backoff
  | { outcome: "bad_input"; error: string };     // hard → fail, no retry

const TRANSIENT = new Set([
  "MS_UNAVAILABLE", "MS_MAX_CONCURRENT_REQ", "GLOBAL_MAX_CONCURRENT_REQ",
  "SERVICE_UNAVAILABLE", "TIMEOUT", "SERVER_BUSY",
]);

export async function checkViesVat(
  countryCode: string,
  vatNumber: string,
  requester?: { memberStateCode: string; number: string }, // set once LyVoX has a BE VAT → POST + requestIdentifier
): Promise<ViesResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000); // GET observed ~3.4s; 8s headroom
  try {
    const digits = vatNumber.replace(/[^0-9A-Za-z]/g, "");
    const url = requester
      ? `${VIES_BASE}/check-vat-number`
      : `${VIES_BASE}/ms/${countryCode}/vat/${digits}`;
    const init: RequestInit = requester
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            countryCode, vatNumber: digits,
            requesterMemberStateCode: requester.memberStateCode, requesterNumber: requester.number,
          }),
          signal: ac.signal, cache: "no-store",
        }
      : { method: "GET", headers: { Accept: "application/json" }, signal: ac.signal, cache: "no-store" };

    const res = await fetch(url, init);
    if (!res.ok) return { outcome: "unavailable", error: `HTTP_${res.status}` };
    const data = await res.json() as Record<string, unknown>;

    if (data?.actionSucceed === false) {
      const code = (data?.errorWrappers as Array<{ error: string }> | undefined)?.[0]?.error ?? "UNKNOWN";
      return TRANSIENT.has(code) ? { outcome: "unavailable", error: code } : { outcome: "bad_input", error: code };
    }
    const isValid = data?.valid ?? data?.isValid; // POST→valid, GET→isValid
    if (isValid === true) {
      return {
        outcome: "valid",
        name: (data.name as string) ?? "", address: (data.address as string) ?? "",
        requestIdentifier: (data.requestIdentifier as string) ?? "", requestDate: data.requestDate as string,
      };
    }
    return { outcome: "invalid", requestDate: data?.requestDate as string };
  } catch (e) {
    return { outcome: "unavailable", error: (e as Error)?.name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
