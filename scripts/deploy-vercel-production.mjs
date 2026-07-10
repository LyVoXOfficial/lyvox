import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { verifyProductionCi } from "./verify-production-ci.mjs";

const VERCEL_API = "https://api.vercel.com";
const PROJECT_NAME = "lyvox-frontend";
const GITHUB_ORG = "LyVoXOfficial";
const GITHUB_REPO = "lyvox";
const GITHUB_REPO_ID = "1061423103";
const PRODUCTION_BRANCH = "main";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const VERCEL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const ACTIVE_DEPLOYMENT_STATES = new Set([
  "QUEUED",
  "INITIALIZING",
  "BUILDING",
]);
const FAILED_DEPLOYMENT_STATES = new Set(["ERROR", "CANCELED", "BLOCKED"]);

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertVercelId(value, name) {
  if (!VERCEL_ID_PATTERN.test(value)) {
    throw new Error(`${name} has an invalid format`);
  }
}

function redact(value, secrets) {
  let result = String(value);
  for (const secret of secrets) {
    if (secret) result = result.replaceAll(secret, "[REDACTED]");
  }
  return result;
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function vercelRequest({
  fetchImpl,
  token,
  teamId,
  path,
  method = "GET",
  body,
  expectJson = true,
}) {
  const url = new URL(path, VERCEL_API);
  url.searchParams.set("teamId", teamId);
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "lyvox-production-release-gate",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(
      `Vercel API request failed for ${method} ${url.pathname}: ${redact(error instanceof Error ? error.message : error, [token])}`,
    );
  }

  if (!response.ok) {
    const detail = redact((await readResponseText(response)).slice(0, 500), [
      token,
    ]);
    throw new Error(
      `Vercel API ${response.status} for ${method} ${url.pathname}${detail ? `: ${detail}` : ""}`,
    );
  }

  if (!expectJson) return { status: response.status };

  try {
    return await response.json();
  } catch {
    throw new Error(
      `Vercel API returned invalid JSON for ${method} ${url.pathname}`,
    );
  }
}

function assertProject(project, { projectId, teamId }) {
  if (
    project?.id !== projectId ||
    project.accountId !== teamId ||
    project.name !== PROJECT_NAME
  ) {
    throw new Error(
      "Vercel project identity does not match the release target",
    );
  }
  if (project.autoAssignCustomDomains !== false) {
    throw new Error(
      "Vercel project must disable automatic Production domain assignment before CI-controlled releases",
    );
  }
  if (
    project.rootDirectory !== "apps/web" ||
    project.framework !== "nextjs" ||
    project.nodeVersion !== "24.x"
  ) {
    throw new Error(
      "Vercel project build settings do not match apps/web on Node 24",
    );
  }
  if (project.commandForIgnoringBuildStep) {
    throw new Error(
      "Vercel Ignored Build Step must be disabled for exact-SHA releases",
    );
  }
  if (
    [
      project.buildCommand,
      project.installCommand,
      project.outputDirectory,
    ].some((value) => value !== undefined && value !== null && value !== "")
  ) {
    throw new Error(
      "Vercel custom build, install and output settings must be disabled",
    );
  }

  const link = project.link;
  if (
    link?.type !== "github" ||
    link.org !== GITHUB_ORG ||
    link.repo !== GITHUB_REPO ||
    String(link.repoId) !== GITHUB_REPO_ID ||
    link.productionBranch !== PRODUCTION_BRANCH
  ) {
    throw new Error(
      "Vercel project Git link does not match canonical LyVoX main",
    );
  }
}

function productionTargetId(project) {
  const targetId = project.targets?.production?.id;
  if (targetId !== undefined && typeof targetId !== "string") {
    throw new Error("Vercel project has an invalid Production target");
  }
  return targetId ?? null;
}

function assertNoActiveProductionTransition(project) {
  const status = project.lastAliasRequest?.jobStatus;
  if (status === "pending" || status === "in-progress") {
    throw new Error(
      "Vercel already has an active Production transition; refusing to race it",
    );
  }
}

function assertDeploymentIdentity(
  deployment,
  { projectId, releaseSha, expectedRunId },
) {
  if (!deployment || typeof deployment !== "object") {
    throw new Error("Vercel returned an invalid deployment object");
  }
  if (!DEPLOYMENT_ID_PATTERN.test(deployment.id ?? "")) {
    throw new Error("Vercel returned an invalid deployment id");
  }
  if (deployment.projectId !== projectId || deployment.name !== PROJECT_NAME) {
    throw new Error("Vercel deployment belongs to a different project");
  }
  if (deployment.target !== "production") {
    throw new Error("Vercel deployment is not a Production build");
  }
  if (
    deployment.gitSource?.type !== "github" ||
    String(deployment.gitSource.repoId) !== GITHUB_REPO_ID ||
    deployment.gitSource.ref !== PRODUCTION_BRANCH ||
    deployment.gitSource.sha?.toLowerCase() !== releaseSha
  ) {
    throw new Error(
      "Vercel deployment Git source does not match the release SHA",
    );
  }
  if (
    deployment.meta?.lyvoxReleaseSha?.toLowerCase() !== releaseSha ||
    String(deployment.meta?.lyvoxCiRunId) !== expectedRunId
  ) {
    throw new Error("Vercel deployment release metadata does not match CI");
  }
  if (deployment.autoAssignCustomDomains !== false) {
    throw new Error("Vercel deployment was not created as a staged build");
  }
  const projectSettings = deployment.projectSettings;
  if (
    projectSettings?.framework !== "nextjs" ||
    projectSettings.nodeVersion !== "24.x" ||
    projectSettings.commandForIgnoringBuildStep ||
    [
      projectSettings.buildCommand,
      projectSettings.installCommand,
      projectSettings.outputDirectory,
    ].some((value) => value !== undefined && value !== null && value !== "")
  ) {
    throw new Error(
      "Vercel deployment captured unexpected project build settings",
    );
  }
}

function deploymentState(deployment) {
  const state = deployment.readyState;
  if (
    state !== "READY" &&
    !ACTIVE_DEPLOYMENT_STATES.has(state) &&
    !FAILED_DEPLOYMENT_STATES.has(state)
  ) {
    throw new Error(
      `Vercel returned unknown deployment state ${String(state)}`,
    );
  }
  return state;
}

function assertStagedReady(deployment) {
  if (deployment.readySubstate !== "STAGED") {
    throw new Error(
      "Vercel READY deployment is not staged for manual promotion",
    );
  }
  if (
    deployment.aliasAssigned !== false ||
    deployment.aliasFinal ||
    (Array.isArray(deployment.alias) && deployment.alias.length > 0)
  ) {
    throw new Error("Vercel staged deployment already has a Production alias");
  }
  if (deployment.buildSkipped !== false) {
    throw new Error("Vercel did not build the exact release SHA");
  }
}

function deploymentUrl(deployment) {
  const rawUrl = deployment.url;
  if (typeof rawUrl !== "string" || rawUrl.length > 253) {
    throw new Error("Vercel deployment URL is invalid");
  }

  const url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  const allowedHost =
    url.hostname.endsWith(".vercel.app") || url.hostname.endsWith(".now.sh");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !allowedHost
  ) {
    throw new Error("Vercel deployment URL is not a safe HTTPS deployment URL");
  }
  return url.href.replace(/\/$/, "");
}

async function waitForStagedDeployment({
  fetchImpl,
  token,
  teamId,
  expected,
  initialDeployment,
  sleep,
  maxDeploymentPolls,
}) {
  let deployment = initialDeployment;

  for (let poll = 0; poll <= maxDeploymentPolls; poll += 1) {
    assertDeploymentIdentity(deployment, expected);
    const state = deploymentState(deployment);
    if (state === "READY") {
      assertStagedReady(deployment);
      return deployment;
    }
    if (FAILED_DEPLOYMENT_STATES.has(state)) {
      throw new Error(`Vercel deployment ended in ${state}`);
    }
    if (poll === maxDeploymentPolls) break;

    await sleep(10_000);
    deployment = await vercelRequest({
      fetchImpl,
      token,
      teamId,
      path: `/v13/deployments/${encodeURIComponent(deployment.id)}`,
    });
  }

  throw new Error("Vercel staged deployment timed out");
}

async function waitForPromotion({
  fetchImpl,
  token,
  teamId,
  expected,
  deploymentId,
  sleep,
  maxPromotionPolls,
}) {
  for (let poll = 0; poll <= maxPromotionPolls; poll += 1) {
    const project = await vercelRequest({
      fetchImpl,
      token,
      teamId,
      path: `/v9/projects/${encodeURIComponent(expected.projectId)}`,
    });
    assertProject(project, expected);

    const aliasRequest = project.lastAliasRequest;
    const matchingAliasRequest = aliasRequest?.toDeploymentId === deploymentId;
    if (
      aliasRequest?.toDeploymentId !== deploymentId &&
      ["pending", "in-progress"].includes(aliasRequest?.jobStatus)
    ) {
      throw new Error("A different Vercel Production transition took over");
    }
    if (matchingAliasRequest) {
      if (aliasRequest.type !== "promote") {
        throw new Error("Vercel returned a non-promote alias request");
      }
      if (["failed", "skipped"].includes(aliasRequest.jobStatus)) {
        throw new Error(`Vercel promotion ended in ${aliasRequest.jobStatus}`);
      }
      if (
        !["pending", "in-progress", "succeeded"].includes(
          aliasRequest.jobStatus,
        )
      ) {
        throw new Error("Vercel returned an unknown promotion job status");
      }
    }

    if (
      matchingAliasRequest &&
      aliasRequest.jobStatus === "succeeded" &&
      project.targets?.production?.id === deploymentId
    ) {
      const deployment = await vercelRequest({
        fetchImpl,
        token,
        teamId,
        path: `/v13/deployments/${encodeURIComponent(deploymentId)}`,
      });
      assertDeploymentIdentity(deployment, expected);
      if (deploymentState(deployment) !== "READY") {
        throw new Error("Promoted Vercel deployment is no longer READY");
      }
      if (deployment.readySubstate === "PROMOTED") return deployment;
      if (
        deployment.readySubstate !== "STAGED" &&
        deployment.readySubstate !== "ROLLING"
      ) {
        throw new Error("Vercel returned an unknown promotion substate");
      }
    }

    if (poll === maxPromotionPolls) break;
    await sleep(2_000);
  }

  throw new Error("Vercel Production promotion timed out");
}

export async function deployVercelProduction({
  env = process.env,
  fetchImpl = fetch,
  verifyCi = verifyProductionCi,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxDeploymentPolls = 180,
  maxPromotionPolls = 150,
} = {}) {
  const token = requiredEnv(env, "VERCEL_TOKEN");
  const teamId = requiredEnv(env, "VERCEL_ORG_ID");
  const projectId = requiredEnv(env, "VERCEL_PROJECT_ID");
  const releaseSha = requiredEnv(env, "RELEASE_SHA").toLowerCase();
  const expectedRunId = requiredEnv(env, "EXPECTED_CI_RUN_ID");
  assertVercelId(teamId, "VERCEL_ORG_ID");
  assertVercelId(projectId, "VERCEL_PROJECT_ID");
  if (!SHA_PATTERN.test(releaseSha)) {
    throw new Error("RELEASE_SHA must be a full 40-character Git commit SHA");
  }
  if (!/^\d+$/.test(expectedRunId)) {
    throw new Error("EXPECTED_CI_RUN_ID must be numeric");
  }

  const expected = { projectId, teamId, releaseSha, expectedRunId };
  await verifyCi({ env, fetchImpl });

  const project = await vercelRequest({
    fetchImpl,
    token,
    teamId,
    path: `/v9/projects/${encodeURIComponent(projectId)}`,
  });
  assertProject(project, expected);
  assertNoActiveProductionTransition(project);
  const productionTargetBeforeBuild = productionTargetId(project);

  const initialDeployment = await vercelRequest({
    fetchImpl,
    token,
    teamId,
    path: "/v13/deployments?forceNew=1",
    method: "POST",
    body: {
      name: PROJECT_NAME,
      project: projectId,
      target: "production",
      gitSource: {
        type: "github",
        repoId: Number(GITHUB_REPO_ID),
        ref: PRODUCTION_BRANCH,
        sha: releaseSha,
      },
      meta: {
        lyvoxReleaseSha: releaseSha,
        lyvoxCiRunId: expectedRunId,
      },
    },
  });

  const stagedDeployment = await waitForStagedDeployment({
    fetchImpl,
    token,
    teamId,
    expected,
    initialDeployment,
    sleep,
    maxDeploymentPolls,
  });

  // Verify GitHub first (it reads main last), then make the final Vercel
  // incident-response drift check immediately before promotion.
  await verifyCi({ env, fetchImpl });
  const projectBeforePromotion = await vercelRequest({
    fetchImpl,
    token,
    teamId,
    path: `/v9/projects/${encodeURIComponent(projectId)}`,
  });
  assertProject(projectBeforePromotion, expected);
  assertNoActiveProductionTransition(projectBeforePromotion);
  if (
    productionTargetId(projectBeforePromotion) !== productionTargetBeforeBuild
  ) {
    throw new Error(
      "Vercel Production target changed while the staged release was building",
    );
  }

  // This request is the only operation allowed to move Production domains.
  const promotionResponse = await vercelRequest({
    fetchImpl,
    token,
    teamId,
    path: `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(stagedDeployment.id)}`,
    method: "POST",
    expectJson: false,
  });
  if (![201, 202].includes(promotionResponse.status)) {
    throw new Error(
      `Vercel promotion returned unexpected status ${promotionResponse.status}`,
    );
  }

  const promotedDeployment = await waitForPromotion({
    fetchImpl,
    token,
    teamId,
    expected,
    deploymentId: stagedDeployment.id,
    sleep,
    maxPromotionPolls,
  });

  return {
    releaseSha,
    ciRunId: expectedRunId,
    deploymentId: promotedDeployment.id,
    url: deploymentUrl(promotedDeployment),
  };
}

function writeGitHubResult(result, env = process.env) {
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `url=${result.url}\n`);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      [
        "## Production deployment",
        "",
        `- SHA: \`${result.releaseSha}\``,
        `- CI run: \`${result.ciRunId}\``,
        `- Vercel deployment: \`${result.deploymentId}\``,
        `- URL: ${result.url}`,
        "",
      ].join("\n"),
    );
  }
}

async function main() {
  try {
    const result = await deployVercelProduction();
    writeGitHubResult(result);
    console.log(
      `Promoted ${result.deploymentId} for CI-verified SHA ${result.releaseSha}`,
    );
  } catch (error) {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
