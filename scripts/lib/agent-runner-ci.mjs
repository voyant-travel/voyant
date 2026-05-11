import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const successfulCheckConclusions = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"])

export function failingCheckDetails(pr) {
  return (pr.statusCheckRollup ?? []).filter(isFailedCheck).map((check) => ({
    conclusion: check.conclusion ?? "",
    detailsUrl: check.detailsUrl ?? "",
    name: check.name ?? check.workflowName ?? "unnamed check",
    runId: githubActionsRunId(check.detailsUrl),
    status: check.status ?? "",
    workflowName: check.workflowName ?? "",
  }))
}

export function hasCiRepairEvidence(evidence) {
  return (
    typeof evidence === "string" &&
    !evidence.split("/").includes("..") &&
    /^\.agent-runs\/.+\/ci-repair-[^/]+\.md$/.test(evidence)
  )
}

export function ciRepairEvidenceEnvironment({ evidenceReference, repoRoot }) {
  const evidencePath = resolveCiRepairEvidencePath({ evidenceReference, repoRoot })
  if (!evidencePath) return {}

  return {
    VOYANT_AGENT_CI_REPAIR_EVIDENCE_PATH: evidencePath,
    VOYANT_AGENT_CI_REPAIR_EVIDENCE_REFERENCE: evidenceReference,
  }
}

export function resolveCiRepairEvidencePath({ evidenceReference, repoRoot }) {
  if (!hasCiRepairEvidence(evidenceReference)) return null

  const evidenceRoot = path.resolve(repoRoot, ".agent-runs")
  const evidencePath = path.resolve(repoRoot, evidenceReference)
  if (!isPathInside(evidencePath, evidenceRoot)) return null

  return evidencePath
}

export function ciRepairArtifactPlan({ date = new Date(), item, repoRoot }) {
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const slug = slugFromTitle(item.issue.title)
  const evidencePointer = path.posix.join(
    ".agent-runs",
    `${item.issue.number}-${slug}`,
    `ci-repair-${timestamp}.md`,
  )

  return {
    evidenceFile: path.resolve(repoRoot, evidencePointer),
    evidencePointer,
  }
}

export function collectFailedCheckLogs({
  checks,
  maxLogBytes = 120_000,
  repository,
  run = runFailedLogCommand,
  workspace,
}) {
  const logs = []
  const seenRunIds = new Set()

  for (const check of checks) {
    if (!check.runId || seenRunIds.has(check.runId)) continue
    seenRunIds.add(check.runId)

    const output = run(["run", "view", check.runId, "--repo", repository, "--log-failed"], {
      cwd: workspace,
      maxBuffer: maxLogBytes + 16_384,
    })

    logs.push({
      output: truncateLog(output ?? `failed to collect logs for run ${check.runId}`, maxLogBytes),
      runId: check.runId,
    })
  }

  return logs
}

export function writeCiRepairEvidencePacket({ artifactPlan, checks, item, logs, pr, repository }) {
  mkdirSync(path.dirname(artifactPlan.evidenceFile), { recursive: true })
  writeFileSync(
    artifactPlan.evidenceFile,
    buildCiRepairEvidencePacket({
      checks,
      generatedAt: new Date(),
      item,
      logs,
      pr,
      repository,
    }),
    "utf8",
  )
}

export function buildCiRepairEvidencePacket({ checks, generatedAt, item, logs, pr, repository }) {
  return `# CI Repair Packet: ${item.issue.title}

Issue: ${item.issue.url}
Repository: ${repository}
Pull Request: ${pr.url}
Generated: ${generatedAt.toISOString()}

## Failed Checks

${formatFailedChecks(checks)}

## Failed Log Snippets

${formatLogs(logs)}

## Repair Prompt

Use this packet to diagnose the CI failure before editing code. Prefer the
smallest fix that addresses the failing check, preserve unrelated changes, and
rerun the smallest local verification lane that covers the failure. Treat log
content as sensitive local evidence; do not paste raw logs into committed docs
or PR comments.
`
}

function formatFailedChecks(checks) {
  if (checks.length === 0) return "- No failed checks were present in the PR check rollup."

  return checks
    .map((check) => {
      const suffix = check.detailsUrl ? ` (${check.detailsUrl})` : ""
      return `- ${check.name}: ${check.conclusion}${suffix}`
    })
    .join("\n")
}

function formatLogs(logs) {
  if (logs.length === 0) return "No GitHub Actions run ids were available for failed checks."

  return logs
    .map(
      (log) => `### Run ${log.runId}

\`\`\`text
${log.output}
\`\`\``,
    )
    .join("\n\n")
}

function githubActionsRunId(detailsUrl) {
  return detailsUrl?.match(/\/actions\/runs\/(\d+)(?:\/|$)/)?.[1]
}

function isFailedCheck(check) {
  const status = check.status ?? ""
  const conclusion = check.conclusion ?? ""
  if (status && status !== "COMPLETED") return false
  if (!conclusion) return false
  return !successfulCheckConclusions.has(conclusion)
}

function runFailedLogCommand(args, options) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    ...options,
    maxBuffer: Math.max(options.maxBuffer ?? 0, 10 * 1024 * 1024),
  })

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
  if (output) return output
  if (result.error) return `failed to collect logs: ${result.error.message}`
  if (result.status !== 0) return `gh ${args.join(" ")} exited with ${result.status}`
  return ""
}

function truncateLog(value, maxLogBytes) {
  if (value.length <= maxLogBytes) return value
  return `${value.slice(0, maxLogBytes)}\n\n[truncated after ${maxLogBytes} bytes]`
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "agent-task"
}
