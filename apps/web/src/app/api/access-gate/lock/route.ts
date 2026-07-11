import {
  ACCESS_GATE_COOKIE_NAME,
  accessGateCookieOptions,
} from "@/lib/security/accessGate";
import { assertSameOrigin } from "@/lib/security/csrf";
import {
  accessGatePageRedirect,
  assertAccessGateSameOrigin,
  readAccessGateForm,
} from "../_shared";

export async function POST(request: Request): Promise<Response> {
  const sharedCsrfError = assertSameOrigin(request);
  if (sharedCsrfError) return sharedCsrfError;
  const csrfError = assertAccessGateSameOrigin(request);
  if (csrfError) return csrfError;

  const form = await readAccessGateForm(request);
  const response = accessGatePageRedirect(
    request,
    form?.get("returnTo") ?? "/",
  );
  response.cookies.set(ACCESS_GATE_COOKIE_NAME, "", {
    ...accessGateCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
