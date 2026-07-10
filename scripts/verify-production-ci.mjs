import { pathToFileURL } from "node:url";

const GITHUB_API = "https://api.github.com";
const CANONICAL_CI_PATH = ".github/workflows/ci.yml";
const CANONICAL_CI_WORKFLOW_ID = 203931925;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const RUN_ID_PATTERN = /^\d+$/;

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function githubJson(fetchImpl, token, path) {
  const response = await fetchImpl(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lyvox-production-ci-gate",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GitHub API ${response.status} for ${path}: ${detail}`);
  }

  return response.json();
}

export async function verifyProductionCi({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const repository = requiredEnv(env, "GITHUB_REPOSITORY");
  const token = requiredEnv(env, "GITHUB_TOKEN");
  const releaseSha = requiredEnv(env, "RELEASE_SHA").toLowerCase();
  const expectedRunId = requiredEnv(env, "EXPECTED_CI_RUN_ID");
  const [owner, repo, extra] = repository.split("/");

  if (!owner || !repo || extra) {
    throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  }
  if (!SHA_PATTERN.test(releaseSha)) {
    throw new Error("RELEASE_SHA must be a full 40-character Git commit SHA");
  }
  if (!RUN_ID_PATTERN.test(expectedRunId)) {
    throw new Error("EXPECTED_CI_RUN_ID must be numeric");
  }

  const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const workflowRun = await githubJson(
    fetchImpl,
    token,
    `/repos/${repoPath}/actions/runs/${expectedRunId}`,
  );
  const canonicalRun =
    String(workflowRun.id) === expectedRunId &&
    workflowRun.workflow_id === CANONICAL_CI_WORKFLOW_ID &&
    workflowRun.path === CANONICAL_CI_PATH &&
    workflowRun.name === "CI" &&
    workflowRun.event === "push" &&
    workflowRun.head_branch === "main" &&
    workflowRun.head_sha?.toLowerCase() === releaseSha &&
    workflowRun.status === "completed" &&
    workflowRun.conclusion === "success";

  if (!canonicalRun) {
    throw new Error(
      `Refusing deployment: workflow run ${expectedRunId} is not the successful canonical CI push for current main`,
    );
  }

  const checkResponse = await githubJson(
    fetchImpl,
    token,
    `/repos/${repoPath}/commits/${releaseSha}/check-runs?check_name=${encodeURIComponent("CI Success")}&filter=latest&per_page=100`,
  );
  const checkRuns = Array.isArray(checkResponse.check_runs)
    ? checkResponse.check_runs
    : [];
  const candidates = checkRuns.filter(
    (check) =>
      check.name === "CI Success" &&
      check.app?.slug === "github-actions" &&
      check.app?.id === 15368 &&
      check.head_sha?.toLowerCase() === releaseSha,
  );
  const matchingRuns = candidates.filter((check) =>
    String(check.details_url ?? check.html_url ?? "").includes(
      `/actions/runs/${expectedRunId}/`,
    ),
  );
  const successfulRun = matchingRuns.find(
    (check) => check.status === "completed" && check.conclusion === "success",
  );

  if (!successfulRun) {
    const observed = matchingRuns.length
      ? matchingRuns
          .map((check) => `${check.status}/${check.conclusion ?? "pending"}`)
          .join(", ")
      : "none";
    throw new Error(
      `Refusing deployment: CI Success from GitHub Actions is not green for ${releaseSha} (observed: ${observed})`,
    );
  }

  // Read main last so the freshness decision is as close as possible to the
  // caller's promotion request.
  const mainRef = await githubJson(
    fetchImpl,
    token,
    `/repos/${repoPath}/git/ref/heads/main`,
  );
  const currentMainSha = mainRef.object?.sha?.toLowerCase();

  if (
    mainRef.object?.type !== "commit" ||
    !SHA_PATTERN.test(currentMainSha ?? "")
  ) {
    throw new Error("GitHub returned an invalid refs/heads/main object");
  }
  if (currentMainSha !== releaseSha) {
    throw new Error(
      `Refusing stale deployment: requested ${releaseSha}, current main is ${currentMainSha}`,
    );
  }

  return {
    releaseSha,
    checkUrl: successfulRun.details_url ?? successfulRun.html_url ?? "",
  };
}

async function main() {
  try {
    const result = await verifyProductionCi();
    console.log(`Production CI gate passed for ${result.releaseSha}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
