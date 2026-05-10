import path from "node:path"

export const commandRunStates = new Set(["Planning", "Running", "Changes Requested", "CI Repair"])

export function canRunCommandState(agentState, { force = false } = {}) {
  return force || commandRunStates.has(agentState)
}

export function commandRunArtifactPlan({
  date = new Date(),
  evidencePath,
  item,
  repoRoot,
  workspaceReference,
}) {
  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const workspace = path.resolve(repoRoot, workspaceReference)
  const evidencePointer =
    evidencePath ?? path.posix.join("docs/agent-evidence/active", `${item.issue.number}-${slug}.md`)
  const evidenceFile = path.resolve(workspace, evidencePointer)
  const logFile = path.resolve(
    repoRoot,
    ".agent-runs",
    `${item.issue.number}-${slug}`,
    `${timestamp}.log`,
  )

  return {
    evidenceFile,
    evidencePointer,
    logFile,
    safeEvidencePath: isPathInside(evidenceFile, workspace),
    workspace,
    workspaceReference,
  }
}

export function commandRunEnvironment({ artifactPlan, branch, item, repository }) {
  return {
    VOYANT_AGENT_BRANCH: branch,
    VOYANT_AGENT_EVIDENCE_PATH: artifactPlan.evidenceFile,
    VOYANT_AGENT_EVIDENCE_REFERENCE: artifactPlan.evidencePointer,
    VOYANT_AGENT_ISSUE: String(item.issue.number),
    VOYANT_AGENT_ISSUE_TITLE: item.issue.title,
    VOYANT_AGENT_ISSUE_URL: item.issue.url,
    VOYANT_AGENT_LOG_PATH: artifactPlan.logFile,
    VOYANT_AGENT_PLAN_PATH: path.resolve(artifactPlan.workspace, item.dryRunPlan.planPath),
    VOYANT_AGENT_REPOSITORY: repository,
    VOYANT_AGENT_VERIFICATION_LANE: item.dryRunPlan.verificationLane,
    VOYANT_AGENT_WORKSPACE: artifactPlan.workspace,
  }
}

export function commandRunFieldUpdate({ date = new Date(), evidencePointer, exitCode }) {
  const values = {
    "Agent State": exitCode === 0 ? "Human Review" : "Blocked",
    "Last Heartbeat": date.toISOString().slice(0, 10),
    Evidence: evidencePointer,
  }

  if (exitCode !== 0) {
    values["Blocked By"] = `run-command exited with ${exitCode}`
  }

  return {
    clear: exitCode === 0 ? ["Blocked By"] : [],
    values,
  }
}

export function buildCommandEvidencePacket({
  artifactPlan,
  branch,
  command,
  exitCode,
  item,
  repository,
  startedAt,
  stoppedAt,
}) {
  const state = exitCode === 0 ? "Human Review" : "Blocked"

  return `# Evidence Packet: ${item.issue.title}

Issue: ${item.issue.url}
Repository: ${repository}
Branch: ${branch}
Workspace: ${artifactPlan.workspace}
Evidence: ${artifactPlan.evidencePointer}
Handoff state: ${state}
Generated: ${stoppedAt.toISOString()}

## Summary

Supervised command completed with exit code ${exitCode}.

## Command

\`\`\`bash
${command}
\`\`\`

## Timing

- Started: ${startedAt.toISOString()}
- Stopped: ${stoppedAt.toISOString()}

## Verification

Runner command transcript: ${artifactPlan.logFile}

## Residual Risks

Review the command transcript and resulting diff before opening or merging a PR.
`
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
