import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoAuditSuppressionConfig,
  evaluateProductionAudit,
} from "./check-production-audit.mjs";

function report({ counts = {}, advisories = {} } = {}) {
  return {
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        ...counts,
      },
    },
    advisories,
    muted: [],
  };
}

test("accepts moderate and low advisories when critical/high and next are absent", () => {
  const result = evaluateProductionAudit(
    report({
      counts: { moderate: 1, low: 1 },
      advisories: {
        1: { severity: "moderate", module_name: "postcss" },
        2: { severity: "low", module_name: "example" },
      },
    }),
  );

  assert.equal(result.ok, true);
});

test("fails closed on a high metadata count", () => {
  const result = evaluateProductionAudit(
    report({
      counts: { high: 1 },
      advisories: {
        10: { severity: "high", module_name: "example" },
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.countBlockers, ["high=1"]);
});

test("fails closed on a critical metadata count", () => {
  const result = evaluateProductionAudit(
    report({
      counts: { critical: 2 },
      advisories: {
        11: { severity: "critical", module_name: "example" },
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.countBlockers, ["critical=2"]);
});

test("blocks a next advisory at any severity", () => {
  const result = evaluateProductionAudit(
    report({
      counts: { moderate: 1 },
      advisories: {
        3: {
          severity: "moderate",
          module_name: "next",
          title: "framework advisory",
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.advisoryBlockers[0]?.moduleName, "next");
});

test("blocks a high advisory even when metadata incorrectly reports zero", () => {
  const result = evaluateProductionAudit(
    report({
      advisories: {
        4: { severity: "high", module_name: "example" },
      },
    }),
  );

  assert.equal(result.ok, false);
});

test("rejects schema drift instead of treating it as a clean audit", () => {
  assert.throws(
    () => evaluateProductionAudit({ metadata: {}, advisories: {} }),
    /vulnerability metadata/,
  );
  assert.throws(
    () => evaluateProductionAudit(report({ counts: { high: "0" } })),
    /non-negative integer/,
  );
  assert.throws(
    () => evaluateProductionAudit({ ...report(), advisories: [] }),
    /advisories object/,
  );
  assert.throws(
    () => evaluateProductionAudit({ ...report(), muted: undefined }),
    /muted array/,
  );
  assert.throws(
    () => evaluateProductionAudit(report({ counts: { moderate: 1 } })),
    /moderate vulnerabilities without moderate advisory details/,
  );
});

test("blocks every muted advisory until a reviewed waiver mechanism exists", () => {
  const result = evaluateProductionAudit({
    ...report(),
    muted: [{ id: "GHSA-example" }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.mutedCount, 1);
});

test("forbids hidden pnpm audit ignore configuration", () => {
  assert.throws(
    () =>
      assertNoAuditSuppressionConfig([
        {
          path: "pnpm-workspace.yaml",
          content: "auditConfig:\n  ignoreGhsas:\n    - GHSA-example\n",
        },
      ]),
    /audit suppression is forbidden/,
  );

  assert.doesNotThrow(() =>
    assertNoAuditSuppressionConfig([
      { path: "package.json", content: '{"name":"safe"}' },
    ]),
  );
});
