import path from "node:path"

import { browserEvidenceMissingReason } from "./agent-runner-browser-evidence.mjs"
import { resolveCiRepairEvidencePath } from "./agent-runner-ci.mjs"
import {
  commandRunBrowserEvidenceBlockReason,
  commandRunFieldUpdate,
} from "./agent-runner-execution.mjs"
import { defaultRemoteWorkspaceRepoDir } from "./agent-runner-remote-bootstrap.mjs"
import { resolveReviewRepairEvidencePath } from "./agent-runner-review.mjs"
import { workspaceDescriptorEnvironment } from "./agent-runner-workspace-contract.mjs"

export function remoteCommandRunArtifactPlan({
  date = new Date(),
  descriptor,
  evidencePath,
  item,
  remoteDir,
  workspaceReference,
}) {
  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const workspace = remoteDir ?? defaultRemoteWorkspaceRepoDir(descriptor)
  const evidencePointer =
    evidencePath ?? path.posix.join("docs/agent-evidence/active", `${item.issue.number}-${slug}.md`)
  const absoluteEvidencePointer = path.posix.isAbsolute(evidencePointer)
  const evidenceFile = absoluteEvidencePointer
    ? evidencePointer
    : path.posix.join(workspace, evidencePointer)
  const logPointer = path.posix.join(
    ".agent-runs",
    `${item.issue.number}-${slug}`,
    `${timestamp}.log`,
  )
  const logFile = path.posix.join(workspace, logPointer)

  return {
    evidenceFile,
    evidencePointer,
    logFile,
    logPointer,
    safeEvidencePath: !absoluteEvidencePointer && isPosixPathInside(evidenceFile, workspace),
    workspace,
    workspaceReference,
  }
}

export function remoteCommandRunEnvironment({
  artifactPlan,
  branch,
  ciRepairEvidencePlan,
  descriptor,
  item,
  repository,
  reviewRepairEvidencePlan,
}) {
  return {
    ...remoteCiRepairEvidenceEnvironment(ciRepairEvidencePlan),
    ...remoteReviewRepairEvidenceEnvironment(reviewRepairEvidencePlan),
    ...workspaceDescriptorEnvironment(descriptor),
    VOYANT_AGENT_BRANCH: branch,
    VOYANT_AGENT_EVIDENCE_PATH: artifactPlan.evidenceFile,
    VOYANT_AGENT_EVIDENCE_REFERENCE: artifactPlan.evidencePointer,
    VOYANT_AGENT_ISSUE: String(item.issue.number),
    VOYANT_AGENT_ISSUE_TITLE: item.issue.title,
    VOYANT_AGENT_ISSUE_URL: item.issue.url,
    VOYANT_AGENT_LOG_PATH: artifactPlan.logFile,
    VOYANT_AGENT_LOG_REFERENCE: artifactPlan.logPointer,
    VOYANT_AGENT_PLAN_PATH: path.posix.join(artifactPlan.workspace, item.dryRunPlan.planPath),
    VOYANT_AGENT_REPOSITORY: repository,
    VOYANT_AGENT_VERIFICATION_LANE: item.dryRunPlan.verificationLane,
    VOYANT_AGENT_WORKSPACE: artifactPlan.workspace,
  }
}

export function remoteCiRepairEvidencePlan({ artifactPlan, item, repoRoot }) {
  const localEvidencePath = resolveCiRepairEvidencePath({
    evidenceReference: item.fields.Evidence,
    repoRoot,
  })
  if (!localEvidencePath) return null

  return {
    evidenceReference: item.fields.Evidence,
    localEvidencePath,
    remoteEvidenceFile: path.posix.join(artifactPlan.workspace, item.fields.Evidence),
  }
}

export function remoteReviewRepairEvidencePlan({ artifactPlan, item, repoRoot }) {
  const localEvidencePath = resolveReviewRepairEvidencePath({
    evidenceReference: item.fields.Evidence,
    repoRoot,
  })
  if (!localEvidencePath) return null

  return {
    evidenceReference: item.fields.Evidence,
    localEvidencePath,
    remoteEvidenceFile: path.posix.join(artifactPlan.workspace, item.fields.Evidence),
  }
}

function remoteCiRepairEvidenceEnvironment(plan) {
  if (!plan) return {}

  return {
    VOYANT_AGENT_CI_REPAIR_EVIDENCE_PATH: plan.remoteEvidenceFile,
    VOYANT_AGENT_CI_REPAIR_EVIDENCE_REFERENCE: plan.evidenceReference,
  }
}

function remoteReviewRepairEvidenceEnvironment(plan) {
  if (!plan) return {}

  return {
    VOYANT_AGENT_REVIEW_REPAIR_EVIDENCE_PATH: plan.remoteEvidenceFile,
    VOYANT_AGENT_REVIEW_REPAIR_EVIDENCE_REFERENCE: plan.evidenceReference,
  }
}

export function remoteCommandRunFieldUpdate(options) {
  const {
    allowMissingBrowserEvidence = false,
    artifactPlan,
    date = new Date(),
    evidenceWriteStatus,
    exitCode,
    item,
    uiEvidence,
  } = options
  const evidenceWriteFailed = evidenceWriteStatus !== 0
  const browserBlock = Object.hasOwn(options, "browserBlockReason")
    ? options.browserBlockReason
    : allowMissingBrowserEvidence || exitCode !== 0
      ? null
      : browserEvidenceMissingReason(item, uiEvidence)
  const blockedBy = evidenceWriteFailed
    ? `remote evidence write exited with ${evidenceWriteStatus}`
    : browserBlock

  return {
    blockedBy,
    ...commandRunFieldUpdate({
      blockedBy,
      date,
      evidencePointer: evidenceWriteFailed ? artifactPlan.logPointer : artifactPlan.evidencePointer,
      exitCode: evidenceWriteFailed ? evidenceWriteStatus : exitCode,
    }),
  }
}

export function remoteCommandRunBrowserEvidenceBlockReason({
  allowBrowserIssues = false,
  exitCode,
  force = false,
  item,
  repoRoot,
  uiEvidence,
}) {
  return commandRunBrowserEvidenceBlockReason({
    allowBrowserIssues,
    exitCode,
    force: force && !uiEvidence?.trim(),
    item,
    uiEvidence,
    workspace: repoRoot,
  })
}

export function remoteLoggedCommandShell({ command, logFile }) {
  assertShellValue("log file", logFile)
  assertShellValue("command", command)

  return `set -euo pipefail
log_file=${shellQuote(logFile)}
user_command=${shellQuote(command)}
mkdir -p "$(dirname "$log_file")"
printf '# %s %s\\n\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$user_command" >> "$log_file"
set +e
bash -lc "$user_command" > >(tee -a "$log_file") 2> >(tee -a "$log_file" >&2)
status=$?
set -e
printf '\\n# exit code: %s\\n' "$status" >> "$log_file"
exit "$status"`
}

export function remoteWriteFileShell({ content, file }) {
  assertShellValue("file", file)

  const encoded = Buffer.from(content, "utf8").toString("base64")
  return `set -euo pipefail
file=${shellQuote(file)}
mkdir -p "$(dirname "$file")"
base64 -d > "$file" <<'VOYANT_REMOTE_FILE'
${encoded}
VOYANT_REMOTE_FILE`
}

function isPosixPathInside(candidatePath, parentPath) {
  const relative = path.posix.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.posix.isAbsolute(relative)
}

function assertShellValue(name, value) {
  if (typeof value !== "string" || value.trim().length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`invalid remote command ${name}: ${String(value)}`)
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
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
