import { NextResponse } from "next/server";
import type { Capability } from "@/lib/capabilities";
import {
  CAPABILITY_REGISTRY,
  getIntegrationStatus,
  isPublicCapability,
} from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCapability(value: string): value is Capability {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_REGISTRY, value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ capability: string }> },
) {
  const { capability } = await params;
  if (!isCapability(capability) || !isPublicCapability(capability)) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const status = await getIntegrationStatus(capability);
  return NextResponse.json(
    { ok: true, data: { capability, effective: status.effective } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
