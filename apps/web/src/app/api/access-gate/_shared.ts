import { NextResponse } from "next/server";
import {
  ACCESS_GATE_PATH,
  sanitizeAccessGateReturnTo,
} from "@/lib/security/accessGate";

const MAX_FORM_BYTES = 4_096;

export function assertAccessGateSameOrigin(request: Request): Response | null {
  // Browser form POSTs carry Origin. Requiring it here makes the gate stricter
  // than general JSON APIs and prevents an ambient-cookie unlock/relock CSRF.
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { ok: false, error: "CSRF_ORIGIN_REQUIRED" },
      { status: 403 },
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",", 1)[0]
      ?.trim();
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim();
    const expectedOrigin = `${forwardedProto || requestUrl.protocol.slice(0, -1)}://${
      forwardedHost || requestUrl.host
    }`;
    if (new URL(origin).origin !== expectedOrigin) {
      return NextResponse.json(
        { ok: false, error: "CSRF_ORIGIN_MISMATCH" },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "CSRF_ORIGIN_MISMATCH" },
      { status: 403 },
    );
  }

  return null;
}

export async function readAccessGateForm(
  request: Request,
): Promise<FormData | null> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded") return null;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_FORM_BYTES)
    return null;

  try {
    if (!request.body) return new FormData();

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        totalBytes += value.byteLength;
        if (totalBytes > MAX_FORM_BYTES) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const params = new URLSearchParams(body);
    const form = new FormData();
    for (const [key, value] of params) form.append(key, value);
    return form;
  } catch {
    return null;
  }
}

export function accessGatePageRedirect(
  request: Request,
  returnToValue: unknown,
  error?: "captcha" | "invalid" | "rate_limited" | "unavailable",
): NextResponse {
  const url = new URL(ACCESS_GATE_PATH, request.url);
  url.searchParams.set("returnTo", sanitizeAccessGateReturnTo(returnToValue));
  if (error) url.searchParams.set("error", error);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
