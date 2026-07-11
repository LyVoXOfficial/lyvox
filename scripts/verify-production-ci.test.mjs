import assert from "node:assert/strict";
import test from "node:test";

import { verifyProductionCi } from "./verify-production-ci.mjs";

const RELEASE_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

const baseEnv = {
  GITHUB_REPOSITORY: "LyVoXOfficial/lyvox",
  GITHUB_TOKEN: "test-token",
  RELEASE_SHA,
  EXPECTED_CI_RUN_ID: "123",
};

function mainRef(sha = RELEASE_SHA) {
  return { object: { type: "commit", sha } };
}

function ciCheck(overrides = {}) {
  return {
    name: "CI Success",
    app: { id: 15368, slug: "github-actions" },
    head_sha: RELEASE_SHA,
    status: "completed",
    conclusion: "success",
    details_url:
      "https://github.com/LyVoXOfficial/lyvox/actions/runs/123/job/456",
    ...overrides,
  };
}

function ciWorkflowRun(overrides = {}) {
  return {
    id: 123,
    workflow_id: 203931925,
    name: "CI",
    path: ".github/workflows/ci.yml",
    event: "push",
    head_branch: "main",
    head_sha: RELEASE_SHA,
    status: "completed",
    conclusion: "success",
    ...overrides,
  };
}

function mockFetch(...payloads) {
  let index = 0;

  return async (url, options) => {
    assert.match(
      url,
      /^https:\/\/api\.github\.com\/repos\/LyVoXOfficial\/lyvox\//,
    );
    assert.equal(options.headers.Authorization, "Bearer test-token");

    const payload = payloads[index++];
    assert.notEqual(
      payload,
      undefined,
      `unexpected GitHub API request: ${url}`,
    );

    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  };
}

test("accepts the current main SHA with the exact green GitHub Actions run", async () => {
  const result = await verifyProductionCi({
    env: baseEnv,
    fetchImpl: mockFetch(
      ciWorkflowRun(),
      { check_runs: [ciCheck()] },
      mainRef(),
    ),
  });

  assert.equal(result.releaseSha, RELEASE_SHA);
  assert.match(result.checkUrl, /\/actions\/runs\/123\/job\/456$/);
});

test("fails closed when main has advanced", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(
        ciWorkflowRun(),
        { check_runs: [ciCheck()] },
        mainRef(OTHER_SHA),
      ),
    }),
    /Refusing stale deployment/,
  );
});

test("fails closed when CI Success is absent", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(ciWorkflowRun(), { check_runs: [] }),
    }),
    /CI Success from GitHub Actions is not green.*observed: none/,
  );
});

test("fails closed when CI Success is red", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(ciWorkflowRun(), {
        check_runs: [ciCheck({ conclusion: "failure" })],
      }),
    }),
    /observed: completed\/failure/,
  );
});

test("rejects a spoofed CI Success check from another GitHub App", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(ciWorkflowRun(), {
        check_runs: [ciCheck({ app: { id: 999, slug: "untrusted-app" } })],
      }),
    }),
    /observed: none/,
  );
});

test("rejects a same-slug CI check from a different GitHub App id", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(ciWorkflowRun(), {
        check_runs: [ciCheck({ app: { id: 999, slug: "github-actions" } })],
      }),
    }),
    /observed: none/,
  );
});

test("rejects a green check from a different workflow run", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(ciWorkflowRun(), {
        check_runs: [
          ciCheck({
            details_url:
              "https://github.com/LyVoXOfficial/lyvox/actions/runs/999/job/456",
          }),
        ],
      }),
    }),
    /observed: none/,
  );
});

test("rejects a successful duplicate-name workflow with a different path", async () => {
  await assert.rejects(
    verifyProductionCi({
      env: baseEnv,
      fetchImpl: mockFetch(
        ciWorkflowRun({
          workflow_id: 999,
          path: ".github/workflows/not-ci.yml",
        }),
      ),
    }),
    /not the successful canonical CI push/,
  );
});

test("rejects a canonical workflow run for a different event, branch, SHA, or result", async (t) => {
  const cases = [
    { event: "pull_request" },
    { head_branch: "develop" },
    { head_sha: OTHER_SHA },
    { conclusion: "failure" },
  ];

  for (const overrides of cases) {
    await t.test(JSON.stringify(overrides), async () => {
      await assert.rejects(
        verifyProductionCi({
          env: baseEnv,
          fetchImpl: mockFetch(ciWorkflowRun(overrides)),
        }),
        /not the successful canonical CI push/,
      );
    });
  }
});
