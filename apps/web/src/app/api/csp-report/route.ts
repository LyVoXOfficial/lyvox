import { NextResponse } from "next/server";
import { logger } from "@/lib/errorLogger";
import {
  createRateLimiter,
  getClientIp,
  withRateLimit,
} from "@/lib/rateLimiter";

const MAX_BODY_BYTES = 8 * 1024;
const cspReportLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: "csp-report:ip",
});

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, maxLength);
}

function safeUrl(value: unknown): string | undefined {
  const text = safeText(value, 1_024);
  if (!text) return undefined;
  if (/^(?:inline|eval|self|none)$/iu.test(text)) return text.toLowerCase();

  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return url.protocol.slice(0, 32);
    }
    return `${url.origin}${url.pathname}`.slice(0, 512);
  } catch {
    return text.split(/[?#]/u, 1)[0]?.slice(0, 256);
  }
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function unwrapReport(parsed: unknown): JsonRecord | null {
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!isRecord(first)) return null;
  const nested = first["csp-report"] ?? first.body;
  return isRecord(nested) ? nested : first;
}

function sanitizeReport(report: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries({
      documentUri: safeUrl(report["document-uri"] ?? report.documentURL),
      blockedUri: safeUrl(report["blocked-uri"] ?? report.blockedURL),
      sourceFile: safeUrl(report["source-file"] ?? report.sourceFile),
      effectiveDirective: safeText(
        report["effective-directive"] ?? report.effectiveDirective,
      ),
      violatedDirective: safeText(
        report["violated-directive"] ?? report.violatedDirective,
      ),
      disposition: safeText(report.disposition, 32),
      statusCode: safeInteger(report["status-code"] ?? report.statusCode),
      lineNumber: safeInteger(report["line-number"] ?? report.lineNumber),
      columnNumber: safeInteger(
        report["column-number"] ?? report.columnNumber,
      ),
    }).filter((entry): entry is [string, string | number] =>
      entry[1] !== undefined,
    ),
  );
}

async function readLimitedUtf8(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

const handleReport = async (request: Request): Promise<Response> => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !contentType.startsWith("application/csp-report") &&
    !contentType.startsWith("application/reports+json") &&
    !contentType.startsWith("application/json")
  ) {
    return new NextResponse(null, { status: 204 });
  }

  const raw = await readLimitedUtf8(request);
  if (!raw) return new NextResponse(null, { status: 204 });

  let metadata: JsonRecord = { malformed: true };
  try {
    const report = unwrapReport(JSON.parse(raw));
    if (report) metadata = sanitizeReport(report);
  } catch {
    // Malformed bodies are acknowledged without logging attacker-controlled text.
  }

  logger.warn("CSP violation reported", {
    component: "csp-report",
    action: "violation",
    metadata,
  });
  return new NextResponse(null, { status: 204 });
};

export const POST = withRateLimit(handleReport, {
  limiter: cspReportLimiter,
  makeKey: (request) => getClientIp(request) ?? "unknown",
});
