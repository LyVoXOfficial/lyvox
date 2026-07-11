"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LAUNCH_MODES, type Capability } from "@/lib/capabilities";
import { getAdminAccess } from "@/lib/auth/requireAdmin";
import {
  CAPABILITY_REGISTRY,
  approvalSettingKey,
  type ApprovalId,
} from "@/lib/integrations/registry";
import {
  activateEmergencyStop,
  capabilitySettingKey,
  getSettingRecord,
  LAUNCH_MODE_SETTING_KEY,
  MONEY_EMERGENCY_STOP_SETTING_KEY,
  STRIPE_RECONCILIATION_SETTING_KEY,
  setSetting,
} from "@/lib/settings/platformSettings";

const capabilityIds = new Set(Object.keys(CAPABILITY_REGISTRY));
const approvalIds = new Set(
  Object.values(CAPABILITY_REGISTRY).flatMap(
    (definition) => definition.requiredApprovals,
  ),
);

const commonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  expectedRevision: z.coerce.number().int().min(-1),
});

async function requireMutationAccess() {
  const access = await getAdminAccess();
  if (!access.ok)
    throw new Error(
      access.reason === "mfa_required" ? "MFA_REQUIRED" : "FORBIDDEN",
    );
  return access.user;
}

function requestId(): string {
  return crypto.randomUUID();
}

function revalidateCapabilitySurfaces() {
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/sell");
  revalidatePath("/legal/terms");
  revalidatePath("/pro");
}

export async function updateCapabilityAction(formData: FormData) {
  await requireMutationAccess();
  const parsed = commonSchema
    .extend({
      capability: z.string(),
      enabled: z.enum(["true", "false"]),
    })
    .parse(Object.fromEntries(formData));

  if (!capabilityIds.has(parsed.capability))
    throw new Error("UNKNOWN_CAPABILITY");
  const capability = parsed.capability as Capability;
  const key = capabilitySettingKey(capability);
  const current = await getSettingRecord(key);
  const currentValue = current?.value ?? {};

  await setSetting(
    key,
    { ...currentValue, enabled: parsed.enabled === "true" },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}

export async function updateCapabilityEmergencyAction(formData: FormData) {
  await requireMutationAccess();
  const parsed = commonSchema
    .extend({
      capability: z.string(),
      disabled: z.enum(["true", "false"]),
      confirmation: z.string().optional(),
    })
    .parse(Object.fromEntries(formData));

  if (!capabilityIds.has(parsed.capability))
    throw new Error("UNKNOWN_CAPABILITY");
  const capability = parsed.capability as Capability;
  const disabled = parsed.disabled === "true";
  if (!disabled && parsed.confirmation !== "CLEAR CAPABILITY STOP") {
    throw new Error("CONFIRMATION_REQUIRED");
  }
  const key = capabilitySettingKey(capability);
  if (disabled) {
    await activateEmergencyStop(key, {
      reason: parsed.reason,
      requestId: requestId(),
    });
    revalidateCapabilitySurfaces();
    return;
  }
  const current = await getSettingRecord(key);
  await setSetting(
    key,
    { ...(current?.value ?? {}), emergencyDisabled: disabled },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}

export async function updateLaunchModeAction(formData: FormData) {
  await requireMutationAccess();
  const parsed = commonSchema
    .extend({ mode: z.enum(LAUNCH_MODES) })
    .parse(Object.fromEntries(formData));

  await setSetting(
    LAUNCH_MODE_SETTING_KEY,
    { mode: parsed.mode },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}

export async function updateMoneyEmergencyStopAction(formData: FormData) {
  await requireMutationAccess();
  const parsed = commonSchema
    .extend({
      stopped: z.enum(["true", "false"]),
      confirmation: z.string().optional(),
    })
    .parse(Object.fromEntries(formData));
  const stopped = parsed.stopped === "true";

  if (!stopped && parsed.confirmation !== "CLEAR MONEY STOP") {
    throw new Error("CONFIRMATION_REQUIRED");
  }

  if (stopped) {
    await activateEmergencyStop(MONEY_EMERGENCY_STOP_SETTING_KEY, {
      reason: parsed.reason,
      requestId: requestId(),
    });
    revalidateCapabilitySurfaces();
    return;
  }

  await setSetting(
    MONEY_EMERGENCY_STOP_SETTING_KEY,
    { stopped },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}

export async function updateStripeReconciliationAction(formData: FormData) {
  await requireMutationAccess();
  const parsed = commonSchema
    .extend({
      enabled: z.enum(["true", "false"]),
      confirmation: z.string().optional(),
    })
    .parse(Object.fromEntries(formData));
  const enabled = parsed.enabled === "true";
  if (enabled && parsed.confirmation !== "ENABLE SIGNED RECONCILIATION") {
    throw new Error("CONFIRMATION_REQUIRED");
  }

  await setSetting(
    STRIPE_RECONCILIATION_SETTING_KEY,
    { enabled },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}

export async function updateApprovalAction(formData: FormData) {
  const user = await requireMutationAccess();
  const parsed = commonSchema
    .extend({
      approval: z.string(),
      approved: z.enum(["true", "false"]),
      evidenceRef: z.string().trim().max(500).optional(),
      expiresAt: z.string().trim().optional(),
    })
    .parse(Object.fromEntries(formData));

  if (!approvalIds.has(parsed.approval as ApprovalId))
    throw new Error("UNKNOWN_APPROVAL");
  const approved = parsed.approved === "true";
  if (approved && (!parsed.evidenceRef || parsed.evidenceRef.length < 3)) {
    throw new Error("EVIDENCE_REQUIRED");
  }
  const expiresAt = parsed.expiresAt
    ? new Date(`${parsed.expiresAt}T23:59:59.999Z`)
    : null;
  if (
    approved &&
    expiresAt &&
    (Number.isNaN(expiresAt.valueOf()) || expiresAt <= new Date())
  ) {
    throw new Error("INVALID_EXPIRY");
  }

  await setSetting(
    approvalSettingKey(parsed.approval as ApprovalId),
    {
      approved,
      evidenceRef: approved ? parsed.evidenceRef : null,
      decidedAt: new Date().toISOString(),
      decidedBy: user.id,
      expiresAt: approved ? (expiresAt?.toISOString() ?? null) : null,
    },
    {
      reason: parsed.reason,
      expectedRevision: parsed.expectedRevision,
      requestId: requestId(),
    },
  );
  revalidateCapabilitySurfaces();
}
