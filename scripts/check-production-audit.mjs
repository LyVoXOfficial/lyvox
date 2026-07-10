import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const AUDIT_SUPPRESSION_PATTERN = /\b(?:ignoreCves|ignoreGhsas)\b/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireCount(counts, severity) {
  const value = counts[severity];
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `pnpm audit metadata.vulnerabilities.${severity} must be a non-negative integer`,
    );
  }
  return value;
}

export function evaluateProductionAudit(report) {
  if (!isObject(report)) {
    throw new Error("pnpm audit report must be a JSON object");
  }

  const countsSource = report.metadata?.vulnerabilities;
  if (!isObject(countsSource)) {
    throw new Error("pnpm audit JSON has no vulnerability metadata");
  }

  const counts = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      requireCount(countsSource, severity),
    ]),
  );

  if (!isObject(report.advisories)) {
    throw new Error("pnpm audit JSON has no advisories object");
  }
  if (!Array.isArray(report.muted)) {
    throw new Error("pnpm audit JSON has no muted array");
  }

  const advisoryBlockers = [];
  const advisorySeverities = new Set();
  for (const [id, advisory] of Object.entries(report.advisories)) {
    if (!isObject(advisory)) {
      throw new Error(`pnpm audit advisory ${id} must be an object`);
    }

    const { severity, module_name: moduleName } = advisory;
    if (!SEVERITIES.includes(severity)) {
      throw new Error(`pnpm audit advisory ${id} has an unknown severity`);
    }
    if (typeof moduleName !== "string" || moduleName.trim() === "") {
      throw new Error(`pnpm audit advisory ${id} has no module_name`);
    }
    advisorySeverities.add(severity);

    if (
      severity === "critical" ||
      severity === "high" ||
      moduleName === "next"
    ) {
      advisoryBlockers.push({
        id,
        moduleName,
        severity,
        title: typeof advisory.title === "string" ? advisory.title : "",
        url: typeof advisory.url === "string" ? advisory.url : "",
      });
    }
  }

  for (const severity of SEVERITIES) {
    if (counts[severity] > 0 && !advisorySeverities.has(severity)) {
      throw new Error(
        `pnpm audit reports ${severity} vulnerabilities without ${severity} advisory details`,
      );
    }
  }

  const countBlockers = [];
  if (counts.critical > 0) countBlockers.push(`critical=${counts.critical}`);
  if (counts.high > 0) countBlockers.push(`high=${counts.high}`);

  return {
    ok:
      countBlockers.length === 0 &&
      advisoryBlockers.length === 0 &&
      report.muted.length === 0,
    counts,
    countBlockers,
    advisoryBlockers,
    mutedCount: report.muted.length,
  };
}

export function assertNoAuditSuppressionConfig(entries) {
  const blockedPaths = entries
    .filter(({ content }) => AUDIT_SUPPRESSION_PATTERN.test(content))
    .map(({ path }) => path);

  if (blockedPaths.length > 0) {
    throw new Error(
      `Unreviewed pnpm audit suppression is forbidden in: ${blockedPaths.join(", ")}`,
    );
  }
}

function loadAuditConfigEntries(root = process.cwd()) {
  const paths = ["package.json", "pnpm-workspace.yaml", ".npmrc"];
  const appsPath = join(root, "apps");
  if (existsSync(appsPath)) {
    for (const entry of readdirSync(appsPath, { withFileTypes: true })) {
      if (entry.isDirectory()) paths.push(`apps/${entry.name}/package.json`);
    }
  }

  return paths
    .map((path) => ({ path, absolute: join(root, path) }))
    .filter(({ absolute }) => existsSync(absolute))
    .map(({ path, absolute }) => ({
      path,
      content: readFileSync(absolute, "utf8"),
    }));
}

export function formatAuditSummary(result, scope = "Production") {
  const lines = [
    `## ${scope} dependency audit`,
    "",
    `Critical: ${result.counts.critical}; high: ${result.counts.high}; moderate: ${result.counts.moderate}; low: ${result.counts.low}.`,
  ];

  if (result.countBlockers.length > 0) {
    lines.push(
      "",
      `- Blocking metadata counts: ${result.countBlockers.join(", ")}`,
    );
  }

  if (result.mutedCount > 0) {
    lines.push("", `- Muted advisories are forbidden: ${result.mutedCount}`);
  }

  for (const blocker of result.advisoryBlockers) {
    const title = blocker.title ? `: ${blocker.title}` : "";
    const url = blocker.url ? ` — ${blocker.url}` : "";
    lines.push(
      `- ${blocker.moduleName} (${blocker.severity}, advisory ${blocker.id})${title}${url}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const auditPath = process.argv[2] ?? process.env.AUDIT_FILE;
  const scope = process.argv[3] ?? process.env.AUDIT_SCOPE ?? "Production";
  if (!auditPath) {
    throw new Error("Audit JSON path is required as argv[2] or AUDIT_FILE");
  }

  assertNoAuditSuppressionConfig(loadAuditConfigEntries());

  let report;
  try {
    report = JSON.parse(readFileSync(auditPath, "utf8"));
  } catch (error) {
    throw new Error(
      `pnpm audit did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = evaluateProductionAudit(report);
  const summary = formatAuditSummary(result, scope);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  if (!result.ok) {
    throw new Error("Production dependency audit contains a blocking result");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
