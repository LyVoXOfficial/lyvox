import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { LAUNCH_MODES, type Capability } from "@/lib/capabilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CAPABILITY_REGISTRY,
  approvalSettingKey,
  getAllIntegrationStatuses,
  getInfrastructureStatuses,
  type ApprovalId,
} from "@/lib/integrations/registry";
import {
  capabilitySettingKey,
  getSettingRecord,
  LAUNCH_MODE_SETTING_KEY,
  MONEY_EMERGENCY_STOP_SETTING_KEY,
  STRIPE_RECONCILIATION_SETTING_KEY,
} from "@/lib/settings/platformSettings";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  updateApprovalAction,
  updateCapabilityAction,
  updateCapabilityEmergencyAction,
  updateLaunchModeAction,
  updateMoneyEmergencyStopAction,
  updateStripeReconciliationAction,
} from "./actions";
import { HealthCheckButton } from "./HealthCheckButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function StateBadge({
  effective,
  desired,
  missingKeys,
}: {
  effective: boolean;
  desired: boolean;
  missingKeys: string[];
}) {
  if (effective) {
    return (
      <Badge className="gap-1 bg-emerald-700">
        <CheckCircle2 className="size-3" />
        ON
      </Badge>
    );
  }
  if (!desired) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CircleOff className="size-3" />
        OFF
      </Badge>
    );
  }
  if (missingKeys.length) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500 text-amber-700"
      >
        <LockKeyhole className="size-3" />
        LOCKED
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-500 text-red-700">
      <ShieldAlert className="size-3" />
      BLOCKED
    </Badge>
  );
}

export default async function AdminSettingsPage() {
  const statuses = await getAllIntegrationStatuses();
  const infrastructure = getInfrastructureStatuses();
  const capabilities = Object.keys(CAPABILITY_REGISTRY) as Capability[];
  const approvals = Array.from(
    new Set(
      Object.values(CAPABILITY_REGISTRY).flatMap(
        (definition) => definition.requiredApprovals,
      ),
    ),
  ) as ApprovalId[];

  const [
    launchRecord,
    moneyStopRecord,
    reconciliationRecord,
    capabilityRecords,
    approvalRecords,
    supabase,
  ] = await Promise.all([
    getSettingRecord(LAUNCH_MODE_SETTING_KEY),
    getSettingRecord(MONEY_EMERGENCY_STOP_SETTING_KEY),
    getSettingRecord(STRIPE_RECONCILIATION_SETTING_KEY),
    Promise.all(
      capabilities.map((capability) =>
        getSettingRecord(capabilitySettingKey(capability)),
      ),
    ),
    Promise.all(
      approvals.map((approval) =>
        getSettingRecord(approvalSettingKey(approval)),
      ),
    ),
    supabaseServer(),
  ]);

  const [
    { data: auditRows, error: auditError },
    { data: healthRows, error: healthError },
  ] = await Promise.all([
    supabase
      .from("settings_audit")
      .select(
        "id, setting_key, revision, operation, actor_id, reason, request_id, source_ip, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("integration_health")
      .select(
        "integration_id, status, checked_at, expires_at, latency_ms, safe_error_code",
      )
      .order("integration_id"),
  ]);

  const launchMode = statuses[0]?.launchMode ?? "contact_only";
  const moneyStopped = moneyStopRecord?.value.stopped !== false;
  const reconciliationEnabled = reconciliationRecord?.value.enabled === true;
  const capabilityRecordMap = new Map(
    capabilities.map((capability, index) => [
      capability,
      capabilityRecords[index],
    ]),
  );
  const approvalRecordMap = new Map(
    approvals.map((approval, index) => [approval, approvalRecords[index]]),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <section className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Runtime control
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Capabilities and launch boundary
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Desired state is never the same as effective state. Keys, approvals,
            implementation, health and launch mode remain independent blockers.
          </p>
        </div>
        <div className="text-left text-xs text-muted-foreground sm:text-right">
          <div>Settings cache: ≤30 seconds</div>
          <div>Secret values are never rendered</div>
        </div>
      </section>

      <section
        aria-labelledby="launch-heading"
        className="grid gap-4 xl:grid-cols-[1.25fr_1fr_1fr]"
      >
        <div className="rounded-md border bg-background p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="launch-heading" className="font-semibold">
                Launch mode
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Money remains impossible in contact-only mode, regardless of
                live keys.
              </p>
            </div>
            <Badge variant="outline" className="font-mono">
              {launchMode}
            </Badge>
          </div>
          <form
            action={updateLaunchModeAction}
            className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]"
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={launchRecord?.revision ?? -1}
            />
            <select
              name="mode"
              defaultValue={launchMode}
              className={inputClass}
              aria-label="Launch mode"
            >
              {LAUNCH_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className={inputClass}
              placeholder="Reason and evidence reference"
            />
            <Button type="submit" variant="outline">
              Apply mode
            </Button>
          </form>
        </div>

        <div
          className={`rounded-md border p-5 ${moneyStopped ? "border-red-300 bg-red-50/70 dark:border-red-950 dark:bg-red-950/20" : "bg-background"}`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`mt-0.5 size-5 ${moneyStopped ? "text-red-700" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Global money emergency stop</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Highest-priority switch across subscriptions, boosts, escrow and
                payouts.
              </p>
            </div>
          </div>
          <form
            action={updateMoneyEmergencyStopAction}
            className="mt-4 space-y-3"
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={moneyStopRecord?.revision ?? -1}
            />
            <input
              type="hidden"
              name="stopped"
              value={moneyStopped ? "false" : "true"}
            />
            {moneyStopped && (
              <input
                name="confirmation"
                required
                className={`${inputClass} w-full font-mono`}
                placeholder="Type CLEAR MONEY STOP"
              />
            )}
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className={`${inputClass} w-full`}
              placeholder="Incident / approval / change reference"
            />
            <Button
              type="submit"
              variant={moneyStopped ? "outline" : "destructive"}
              className="w-full"
            >
              {moneyStopped
                ? "Clear stop after all gates pass"
                : "STOP ALL MONEY"}
            </Button>
          </form>
        </div>

        <div className="rounded-md border bg-background p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Signed Stripe reconciliation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keeps cancellations and failures for known records working while
                new sales are stopped.
              </p>
            </div>
          </div>
          <form
            action={updateStripeReconciliationAction}
            className="mt-4 space-y-3"
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={reconciliationRecord?.revision ?? -1}
            />
            <input
              type="hidden"
              name="enabled"
              value={reconciliationEnabled ? "false" : "true"}
            />
            {!reconciliationEnabled && (
              <input
                name="confirmation"
                required
                className={`${inputClass} w-full font-mono`}
                placeholder="Type ENABLE SIGNED RECONCILIATION"
              />
            )}
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className={`${inputClass} w-full`}
              placeholder="Activation / retirement evidence"
            />
            <Button type="submit" variant="outline" className="w-full">
              {reconciliationEnabled
                ? "Disable reconciliation"
                : "Enable reconciliation"}
            </Button>
          </form>
        </div>
      </section>

      <section aria-labelledby="capabilities-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="capabilities-heading" className="text-lg font-semibold">
              Capability registry
            </h2>
            <p className="text-sm text-muted-foreground">
              Single-item changes only. There is no bulk enable.
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {statuses.filter((status) => status.effective).length}/
            {statuses.length} effective
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Capability</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">
                  Requirements / blockers
                </th>
                <th className="px-4 py-3 font-medium">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statuses.map((status) => {
                const record = capabilityRecordMap.get(status.capability);
                return (
                  <tr key={status.capability} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium">{status.label}</div>
                      <div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                        {status.description}
                      </div>
                      <code className="mt-2 block text-[11px] text-muted-foreground">
                        {status.capability} · {status.implementation}
                      </code>
                    </td>
                    <td className="px-4 py-4">
                      <StateBadge
                        effective={status.effective}
                        desired={status.desired}
                        missingKeys={status.missingKeys}
                      />
                      <div className="mt-2 text-xs text-muted-foreground">
                        requires {status.minimumLaunchMode}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {status.blockers.length ? (
                        <ul className="space-y-1.5 text-xs">
                          {status.blockers.map((blocker) => (
                            <li key={blocker.code}>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {blocker.code}
                              </span>{" "}
                              — {blocker.detail}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-emerald-700">
                          All activation checks pass.
                        </span>
                      )}
                      {status.missingKeys.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {status.missingKeys.map((key) => (
                            <Badge
                              key={key}
                              variant="outline"
                              className="gap-1 font-mono text-[10px]"
                            >
                              <KeyRound className="size-3" />
                              {key}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <form
                        action={updateCapabilityAction}
                        className="w-64 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="capability"
                          value={status.capability}
                        />
                        <input
                          type="hidden"
                          name="enabled"
                          value={status.desired ? "false" : "true"}
                        />
                        <input
                          type="hidden"
                          name="expectedRevision"
                          value={record?.revision ?? -1}
                        />
                        <input
                          name="reason"
                          required
                          minLength={3}
                          maxLength={500}
                          className={`${inputClass} w-full`}
                          placeholder="Reason / ticket"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant={status.desired ? "outline" : "default"}
                          className="w-full"
                        >
                          Set desired {status.desired ? "OFF" : "ON"}
                        </Button>
                      </form>
                      <form
                        action={updateCapabilityEmergencyAction}
                        className="mt-2 w-64 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="capability"
                          value={status.capability}
                        />
                        <input
                          type="hidden"
                          name="disabled"
                          value={
                            status.capabilityEmergencyDisabled
                              ? "false"
                              : "true"
                          }
                        />
                        <input
                          type="hidden"
                          name="expectedRevision"
                          value={record?.revision ?? -1}
                        />
                        {status.capabilityEmergencyDisabled && (
                          <input
                            name="confirmation"
                            required
                            className={`${inputClass} w-full font-mono`}
                            placeholder="CLEAR CAPABILITY STOP"
                          />
                        )}
                        <input
                          name="reason"
                          required
                          minLength={3}
                          maxLength={500}
                          className={`${inputClass} w-full`}
                          placeholder="Incident / recovery reason"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant={
                            status.capabilityEmergencyDisabled
                              ? "outline"
                              : "destructive"
                          }
                          className="w-full"
                        >
                          {status.capabilityEmergencyDisabled
                            ? "Clear capability stop"
                            : "Emergency OFF"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="approvals-heading" className="space-y-3">
        <div>
          <h2 id="approvals-heading" className="text-lg font-semibold">
            External approvals
          </h2>
          <p className="text-sm text-muted-foreground">
            Evidence is required to approve; a checkbox alone cannot unlock
            regulated functionality.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {approvals.map((approval) => {
            const record = approvalRecordMap.get(approval);
            const approved = record?.value.approved === true;
            return (
              <form
                key={approval}
                action={updateApprovalAction}
                className="rounded-md border bg-background p-4"
              >
                <input type="hidden" name="approval" value={approval} />
                <input
                  type="hidden"
                  name="approved"
                  value={approved ? "false" : "true"}
                />
                <input
                  type="hidden"
                  name="expectedRevision"
                  value={record?.revision ?? -1}
                />
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs font-semibold">{approval}</code>
                  <Badge variant={approved ? "default" : "secondary"}>
                    {approved ? "APPROVED" : "MISSING"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {!approved && (
                    <input
                      name="evidenceRef"
                      required
                      minLength={3}
                      maxLength={500}
                      className={inputClass}
                      placeholder="Evidence URL / document ID"
                    />
                  )}
                  {!approved && (
                    <input
                      name="expiresAt"
                      type="date"
                      className={inputClass}
                      aria-label="Optional approval expiry"
                    />
                  )}
                  <input
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    className={inputClass}
                    placeholder={
                      approved ? "Revocation reason" : "Approval reason"
                    }
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                >
                  {approved ? "Revoke approval" : "Record approval"}
                </Button>
              </form>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="infra-heading" className="space-y-3">
        <div>
          <h2 id="infra-heading" className="text-lg font-semibold">
            Integration readiness
          </h2>
          <p className="text-sm text-muted-foreground">
            Configuration and last safe health snapshot. Credential values are
            never exposed.
          </p>
        </div>
        {(healthError || auditError) && (
          <p role="alert" className="text-sm text-destructive">
            Operational data is incomplete:{" "}
            {healthError?.message ?? auditError?.message}
          </p>
        )}
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Integration</th>
                <th className="px-4 py-3">Config</th>
                <th className="px-4 py-3">Last health</th>
                <th className="px-4 py-3">Missing keys</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {infrastructure.map((integration) => {
                const health = healthRows?.find(
                  (row) => row.integration_id === integration.id,
                );
                return (
                  <tr key={integration.id}>
                    <td className="px-4 py-3 font-medium">
                      {integration.label}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={integration.ready ? "default" : "secondary"}
                        >
                          {integration.ready ? "CONFIGURED" : "INCOMPLETE"}
                        </Badge>
                        <HealthCheckButton integrationId={integration.id} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {health
                        ? `${health.status} · ${new Date(health.checked_at).toLocaleString("en-BE")}${health.latency_ms == null ? "" : ` · ${health.latency_ms}ms`}`
                        : "No check recorded"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {integration.missingKeys.join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="audit-heading" className="space-y-3">
        <div>
          <h2 id="audit-heading" className="text-lg font-semibold">
            Immutable change log
          </h2>
          <p className="text-sm text-muted-foreground">
            Most recent 50 changes. Before/after values remain in the protected
            database record.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Setting</th>
                <th className="px-4 py-3">Rev</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Request</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(auditRows ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {new Date(row.created_at).toLocaleString("en-BE")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.setting_key}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.revision}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    {row.actor_id}
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs">{row.reason}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    {row.request_id}
                  </td>
                </tr>
              ))}
              {!auditRows?.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No audited changes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
