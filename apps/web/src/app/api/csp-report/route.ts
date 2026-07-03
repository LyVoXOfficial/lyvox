import { NextResponse } from "next/server";
import { logger } from "@/lib/errorLogger";

// CSP violation report collector (audit A-1 step 1). The Report-Only header
// points here via `report-uri`; browsers POST application/csp-report bodies.
// Observation phase only: log and acknowledge. No auth — browsers send these
// anonymously — so the handler must stay cheap and never throw.

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    let report: unknown = null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Standard shape is {"csp-report": {...}}; Reporting-API sends an array.
      report = parsed["csp-report"] ?? parsed;
    } catch {
      report = raw.slice(0, 512);
    }

    logger.warn("CSP violation reported", {
      component: "csp-report",
      action: "violation",
      metadata: { report },
    });
  } catch {
    // Never let the collector become an error source of its own.
  }

  return new NextResponse(null, { status: 204 });
}
