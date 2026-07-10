import assert from "node:assert/strict";
import test from "node:test";

import { deployVercelProduction } from "./deploy-vercel-production.mjs";

const RELEASE_SHA = "a".repeat(40);
const DEPLOYMENT_ID = "dpl_AbCdEf123";
const PROJECT_ID = "prj_Lyvox123";
const TEAM_ID = "team_Lyvox123";

const baseEnv = {
  GITHUB_REPOSITORY: "LyVoXOfficial/lyvox",
  GITHUB_TOKEN: "github-test-token",
  RELEASE_SHA,
  EXPECTED_CI_RUN_ID: "123",
  VERCEL_TOKEN: "vercel-test-token",
  VERCEL_ORG_ID: TEAM_ID,
  VERCEL_PROJECT_ID: PROJECT_ID,
};

function project(overrides = {}) {
  return {
    id: PROJECT_ID,
    accountId: TEAM_ID,
    name: "lyvox-frontend",
    autoAssignCustomDomains: false,
    rootDirectory: "apps/web",
    framework: "nextjs",
    nodeVersion: "24.x",
    commandForIgnoringBuildStep: null,
    buildCommand: null,
    installCommand: null,
    outputDirectory: null,
    link: {
      type: "github",
      org: "LyVoXOfficial",
      repo: "lyvox",
      repoId: 1061423103,
      productionBranch: "main",
    },
    ...overrides,
  };
}

function deployment(overrides = {}) {
  return {
    id: DEPLOYMENT_ID,
    projectId: PROJECT_ID,
    name: "lyvox-frontend",
    target: "production",
    readyState: "READY",
    readySubstate: "STAGED",
    autoAssignCustomDomains: false,
    aliasAssigned: false,
    alias: [],
    buildSkipped: false,
    gitSource: {
      type: "github",
      repoId: 1061423103,
      ref: "main",
      sha: RELEASE_SHA,
    },
    meta: {
      lyvoxReleaseSha: RELEASE_SHA,
      lyvoxCiRunId: "123",
    },
    projectSettings: {
      framework: "nextjs",
      nodeVersion: "24.x",
      commandForIgnoringBuildStep: null,
      buildCommand: null,
      installCommand: null,
      outputDirectory: null,
    },
    url: "lyvox-frontend-abc.vercel.app",
    ...overrides,
  };
}

function response(payload, { status = 200, raw = "" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => raw || JSON.stringify(payload),
  };
}

function mockVercelFetch(steps) {
  let index = 0;
  const calls = [];

  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.vercel.com");
    assert.equal(url.searchParams.get("teamId"), TEAM_ID);
    assert.equal(options.headers.Authorization, "Bearer vercel-test-token");

    const step = steps[index++];
    assert.notEqual(step, undefined, `unexpected request ${url}`);
    calls.push({ url, options });
    if (step.assert) step.assert({ url, options });
    if (step.error) throw step.error;
    return response(step.payload, step.response);
  };

  return { fetchImpl, calls, done: () => assert.equal(index, steps.length) };
}

function successfulSteps() {
  return [
    { payload: project() },
    {
      assert: ({ url, options }) => {
        assert.equal(options.method, "POST");
        assert.equal(url.pathname, "/v13/deployments");
        assert.equal(url.searchParams.get("forceNew"), "1");
        assert.deepEqual(JSON.parse(options.body), {
          name: "lyvox-frontend",
          project: PROJECT_ID,
          target: "production",
          gitSource: {
            type: "github",
            repoId: 1061423103,
            ref: "main",
            sha: RELEASE_SHA,
          },
          meta: {
            lyvoxReleaseSha: RELEASE_SHA,
            lyvoxCiRunId: "123",
          },
        });
      },
      payload: deployment({ readyState: "BUILDING", readySubstate: undefined }),
    },
    { payload: deployment() },
    { payload: project() },
    {
      assert: ({ url, options }) => {
        assert.equal(options.method, "POST");
        assert.equal(
          url.pathname,
          `/v10/projects/${PROJECT_ID}/promote/${DEPLOYMENT_ID}`,
        );
        assert.equal(options.body, undefined);
        assert.equal(options.headers["Content-Type"], undefined);
      },
      payload: undefined,
      response: { status: 202 },
    },
    {
      payload: project({
        lastAliasRequest: {
          type: "promote",
          toDeploymentId: DEPLOYMENT_ID,
          jobStatus: "in-progress",
        },
        targets: { production: { id: DEPLOYMENT_ID } },
      }),
    },
    {
      payload: project({
        lastAliasRequest: {
          type: "promote",
          toDeploymentId: DEPLOYMENT_ID,
          jobStatus: "succeeded",
        },
        targets: { production: { id: DEPLOYMENT_ID } },
      }),
    },
    { payload: deployment({ readySubstate: "ROLLING" }) },
    {
      payload: project({
        lastAliasRequest: {
          type: "promote",
          toDeploymentId: DEPLOYMENT_ID,
          jobStatus: "succeeded",
        },
        targets: { production: { id: DEPLOYMENT_ID } },
      }),
    },
    { payload: deployment({ readySubstate: "PROMOTED" }) },
  ];
}

test("builds an exact-SHA staged deployment and promotes only after a second CI check", async () => {
  const mock = mockVercelFetch(successfulSteps());
  let verifyCalls = 0;

  const result = await deployVercelProduction({
    env: baseEnv,
    fetchImpl: mock.fetchImpl,
    verifyCi: async () => {
      verifyCalls += 1;
      return { releaseSha: RELEASE_SHA };
    },
    sleep: async () => {},
  });

  mock.done();
  assert.equal(verifyCalls, 2);
  assert.deepEqual(result, {
    releaseSha: RELEASE_SHA,
    ciRunId: "123",
    deploymentId: DEPLOYMENT_ID,
    url: "https://lyvox-frontend-abc.vercel.app",
  });
});

test("rejects a project that can auto-assign Production domains", async () => {
  const mock = mockVercelFetch([
    { payload: project({ autoAssignCustomDomains: true }) },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /must disable automatic Production domain assignment/,
  );
  mock.done();
});

test("rejects a linked repository mismatch before creating a deployment", async () => {
  const mock = mockVercelFetch([
    {
      payload: project({
        link: { ...project().link, repoId: 999 },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /Git link does not match/,
  );
  mock.done();
});

test("rejects mismatched Vercel build settings", async (t) => {
  const cases = [
    { rootDirectory: "." },
    { framework: "nuxtjs" },
    { nodeVersion: "22.x" },
    { commandForIgnoringBuildStep: "exit 0" },
    { buildCommand: "npm run noncanonical-build" },
    { installCommand: "npm install --ignore-scripts" },
    { outputDirectory: "dist" },
  ];

  for (const overrides of cases) {
    await t.test(JSON.stringify(overrides), async () => {
      const mock = mockVercelFetch([{ payload: project(overrides) }]);
      await assert.rejects(
        deployVercelProduction({
          env: baseEnv,
          fetchImpl: mock.fetchImpl,
          verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
          sleep: async () => {},
        }),
        /build settings do not match|Ignored Build Step must be disabled|custom build, install and output settings/,
      );
      mock.done();
    });
  }
});

test("rejects a deployment response with a different SHA", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    {
      payload: deployment({
        gitSource: { ...deployment().gitSource, sha: "b".repeat(40) },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /Git source does not match/,
  );
  mock.done();
});

test("rejects a deployment snapshot with different build settings", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    {
      payload: deployment({
        projectSettings: {
          ...deployment().projectSettings,
          nodeVersion: "22.x",
        },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /captured unexpected project build settings/,
  );
  mock.done();
});

test("rejects a deployment snapshot with a custom output directory", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    {
      payload: deployment({
        projectSettings: {
          ...deployment().projectSettings,
          outputDirectory: "dist",
        },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /captured unexpected project build settings/,
  );
  mock.done();
});

test("fails closed on terminal and unknown deployment states", async (t) => {
  for (const state of ["ERROR", "BLOCKED", "PAUSED"]) {
    await t.test(state, async () => {
      const mock = mockVercelFetch([
        { payload: project() },
        {
          payload: deployment({
            readyState: state,
            readySubstate: undefined,
          }),
        },
      ]);
      await assert.rejects(
        deployVercelProduction({
          env: baseEnv,
          fetchImpl: mock.fetchImpl,
          verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
          sleep: async () => {},
        }),
        ["ERROR", "BLOCKED"].includes(state)
          ? new RegExp(`ended in ${state}`)
          : /unknown deployment state/,
      );
      mock.done();
    });
  }
});

test("rejects a READY deployment when Vercel skipped the build", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    { payload: deployment({ buildSkipped: true }) },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /did not build the exact release SHA/,
  );
  mock.done();
});

test("does not promote when main advances while the staged build runs", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    { payload: deployment() },
  ]);
  let verifyCalls = 0;

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => {
        verifyCalls += 1;
        if (verifyCalls === 2) throw new Error("main advanced");
        return { releaseSha: RELEASE_SHA };
      },
      sleep: async () => {},
    }),
    /main advanced/,
  );
  mock.done();
});

test("does not overwrite a Production target changed during the build", async () => {
  const mock = mockVercelFetch([
    {
      payload: project({
        targets: { production: { id: "dpl_Previous123" } },
      }),
    },
    { payload: deployment() },
    {
      payload: project({
        targets: { production: { id: "dpl_EmergencyRollback123" } },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /Production target changed while the staged release was building/,
  );
  mock.done();
});

test("does not race an active emergency Production transition", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    { payload: deployment() },
    {
      payload: project({
        lastAliasRequest: {
          toDeploymentId: "dpl_EmergencyRollback123",
          jobStatus: "in-progress",
        },
      }),
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /active Production transition/,
  );
  mock.done();
});

test("rejects a promotion that points Production at another deployment", async () => {
  const steps = successfulSteps();
  steps.splice(5, 5, {
    payload: project({
      targets: { production: { id: "dpl_Other123" } },
    }),
  });
  const mock = mockVercelFetch(steps);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
      maxPromotionPolls: 0,
    }),
    /promotion timed out/,
  );
  mock.done();
});

test("rejects an undocumented successful promotion status", async () => {
  const steps = successfulSteps();
  steps[4].response = { status: 204 };
  steps.splice(5);
  const mock = mockVercelFetch(steps);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /promotion returned unexpected status 204/,
  );
  mock.done();
});

test("waits for alias job success before accepting a PROMOTED deployment", async () => {
  const steps = successfulSteps();
  steps[7].payload = deployment({ readySubstate: "PROMOTED" });
  steps.splice(8);
  const mock = mockVercelFetch(steps);

  const result = await deployVercelProduction({
    env: baseEnv,
    fetchImpl: mock.fetchImpl,
    verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
    sleep: async () => {},
  });

  assert.equal(result.deploymentId, DEPLOYMENT_ID);
  mock.done();
});

test("rejects an unknown matching promotion job status", async () => {
  const steps = successfulSteps();
  steps.splice(5, 5, {
    payload: project({
      lastAliasRequest: {
        type: "promote",
        toDeploymentId: DEPLOYMENT_ID,
        jobStatus: "mystery",
      },
    }),
  });
  const mock = mockVercelFetch(steps);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    /unknown promotion job status/,
  );
  mock.done();
});

test("redacts the Vercel token from API failures", async () => {
  const mock = mockVercelFetch([
    {
      payload: {},
      response: {
        status: 500,
        raw: "backend echoed vercel-test-token",
      },
    },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
    }),
    (error) => {
      assert.doesNotMatch(error.message, /vercel-test-token/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
  mock.done();
});

test("times out a deployment that never becomes READY", async () => {
  const mock = mockVercelFetch([
    { payload: project() },
    { payload: deployment({ readyState: "QUEUED", readySubstate: undefined }) },
  ]);

  await assert.rejects(
    deployVercelProduction({
      env: baseEnv,
      fetchImpl: mock.fetchImpl,
      verifyCi: async () => ({ releaseSha: RELEASE_SHA }),
      sleep: async () => {},
      maxDeploymentPolls: 0,
    }),
    /staged deployment timed out/,
  );
  mock.done();
});
