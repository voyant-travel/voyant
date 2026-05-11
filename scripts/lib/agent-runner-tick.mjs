import {
  browserEvidenceReferenceKind,
  requiresBrowserEvidence,
} from "./agent-runner-browser-evidence.mjs"
import { hasCiRepairEvidence } from "./agent-runner-ci.mjs"
import { evaluateHeartbeat } from "./agent-runner-output.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./agent-runner-workspace-contract.mjs"

const runnableStates = new Set(["Planning", "Changes Requested", "CI Repair"])
const stalePreemptionStates = new Set(["Planning", "Running", "Changes Requested", "CI Repair"])
const watchedStates = new Set([
  "Planning",
  "Running",
  "Blocked",
  "Human Review",
  "Changes Requested",
  "CI Repair",
])

export function recommendQueueActions(items, { maxAgeDays, repository }) {
  return items
    .map((item) => recommendQueueAction(item, { maxAgeDays, repository }))
    .filter((recommendation) => recommendation.action !== "ignore")
    .sort(
      (left, right) =>
        left.priority - right.priority || (left.issue?.number ?? 0) - (right.issue?.number ?? 0),
    )
}

export function recommendQueueAction(item, { maxAgeDays, repository }) {
  if (!item.issue) {
    return recommendation(item, {
      action: "ignore",
      command: null,
      priority: 999,
      reason: "project item has no issue content",
    })
  }

  const state = item.fields["Agent State"]
  const heartbeat = watchedStates.has(state)
    ? evaluateHeartbeat(item.fields["Last Heartbeat"], { maxAgeDays })
    : null

  if (stalePreemptionStates.has(state) && heartbeat?.stale) {
    return recommendation(item, {
      action: "inspect-stale",
      command: commandWithRepo({ command: "watchdog", repository }),
      heartbeat,
      priority: 10,
      reason: heartbeat.reason,
    })
  }

  const workspaceRecommendation = remoteWorkspaceRecommendation(item, { heartbeat, repository })
  if (workspaceRecommendation) {
    return workspaceRecommendation
  }

  if (item.ready) {
    return recommendation(item, {
      action: "start",
      command: commandWithIssue({ command: "start", issueNumber: item.issue.number, repository }),
      priority: 20,
      reason: "maintainer-approved item is ready to claim",
    })
  }

  const browserRecommendation = browserEvidenceRecommendation(item, { heartbeat, repository })
  if (browserRecommendation) {
    return browserRecommendation
  }

  if (state === "CI Repair" && item.fields.PR && !hasCiRepairEvidence(item.fields.Evidence)) {
    return recommendation(item, {
      action: "collect-ci",
      command: commandWithIssue({
        command: "collect-ci",
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 28,
      reason: "failing PR checks need a local CI repair packet",
    })
  }

  if (state === "CI Repair" && hasCiRepairEvidence(item.fields.Evidence)) {
    return recommendation(item, {
      action: "run-command",
      command: commandWithIssue({
        command: "run-command",
        extraArgs: ['--command "<ci-repair-command>"'],
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 30,
      reason: "CI repair packet is ready for a narrow repair command",
    })
  }

  if (runnableStates.has(state)) {
    return recommendation(item, {
      action: "run-command",
      command: commandWithIssue({
        command: "run-command",
        extraArgs: ['--command "<implementation-command>"'],
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 30,
      reason: `item is in ${state}`,
    })
  }

  if (state === "Running") {
    return recommendation(item, {
      action: "wait-running",
      command: null,
      heartbeat,
      priority: 40,
      reason: "command execution is already marked running",
    })
  }

  if (state === "Human Review") {
    return humanReviewRecommendation(item, { heartbeat, repository })
  }

  if (state === "Merge Ready") {
    if (item.fields.PR) {
      return recommendation(item, {
        action: "sync-pr",
        command: commandWithIssue({
          command: "sync-pr",
          issueNumber: item.issue.number,
          repository,
        }),
        heartbeat,
        priority: 50,
        reason: "merge-ready PR should be checked for maintainer merge",
      })
    }

    return recommendation(item, {
      action: "wait-maintainer-merge",
      command: null,
      heartbeat,
      priority: 80,
      reason: "PR is ready for maintainer merge",
    })
  }

  if ((state === "Done" || state === "Abandoned") && item.fields.Workspace) {
    return recommendation(item, {
      action: "cleanup",
      command: commandWithIssue({ command: "cleanup", issueNumber: item.issue.number, repository }),
      priority: 90,
      reason: `terminal item still has Workspace set`,
    })
  }

  if (state === "Blocked") {
    return recommendation(item, {
      action: "inspect-blocked",
      command: null,
      heartbeat,
      priority: 95,
      reason: item.fields["Blocked By"] ?? "item is blocked",
    })
  }

  return recommendation(item, {
    action: "ignore",
    command: null,
    priority: 999,
    reason: item.reasons.join("; ") || `Agent State is ${state ?? "unset"}`,
  })
}

function remoteWorkspaceRecommendation(item, { heartbeat, repository }) {
  const workspace = item.fields.Workspace
  if (!workspace) return null

  const descriptor = parseWorkspaceReference(workspace, { repoRoot: "/" })
  const state = item.fields["Agent State"]

  if (descriptor.kind === "invalid") {
    return recommendation(item, {
      action: "inspect-workspace",
      command: null,
      heartbeat,
      priority: 25,
      reason: `invalid Workspace: ${descriptor.reason}`,
    })
  }

  if (!isRemoteWorkspaceDescriptor(descriptor)) return null

  if (state === "Human Review" && item.fields.PR) return null
  if (state === "Merge Ready" && item.fields.PR) return null

  if (item.ready) {
    return recommendation(item, {
      action: "remote-bootstrap",
      command: commandWithIssue({
        command: "remote-bootstrap",
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 20,
      reason: `remote workspace ${descriptor.reference} is ready for repository bootstrap`,
    })
  }

  if (state === "CI Repair" && item.fields.PR && !hasCiRepairEvidence(item.fields.Evidence)) {
    return null
  }

  if (["Planning", "Changes Requested", "CI Repair"].includes(state)) {
    return recommendation(item, {
      action: "remote-run-command",
      command: commandWithIssue({
        command: "remote-run-command",
        extraArgs: ['--command "<implementation-command>"'],
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 30,
      reason: `remote workspace ${descriptor.reference} is ready for supervised command execution`,
    })
  }

  if (state === "Running") {
    return recommendation(item, {
      action: "wait-running",
      command: null,
      heartbeat,
      priority: 40,
      reason: "remote command execution is already marked running",
    })
  }

  if (state === "Done" || state === "Abandoned") {
    return recommendation(item, {
      action: "wait-remote-cleanup",
      command: commandWithIssue({
        command: "remote-inspect",
        issueNumber: item.issue.number,
        mutate: false,
        repository,
      }),
      heartbeat,
      priority: 90,
      reason: `remote workspace ${descriptor.reference} needs remote adapter cleanup`,
    })
  }

  if (
    ["Ready", "Planning", "Running", "Changes Requested", "CI Repair", "Human Review"].includes(
      state,
    ) ||
    item.ready
  ) {
    return recommendation(item, {
      action: "wait-remote-adapter",
      command: commandWithIssue({
        command: "remote-inspect",
        issueNumber: item.issue.number,
        mutate: false,
        repository,
      }),
      heartbeat,
      priority: 29,
      reason: `remote workspace ${descriptor.reference} requires a remote adapter`,
    })
  }

  return null
}

function humanReviewRecommendation(item, { heartbeat, repository }) {
  const evidence = item.fields.Evidence
  const pr = item.fields.PR

  if (!evidence) {
    const browserRecommendation = browserEvidenceRecommendation(item, { heartbeat, repository })
    if (browserRecommendation) return browserRecommendation
  }

  if (pr) {
    return recommendation(item, {
      action: "sync-pr",
      command: commandWithIssue({ command: "sync-pr", issueNumber: item.issue.number, repository }),
      heartbeat,
      priority: 50,
      reason: "linked PR should be synced back to the Project",
    })
  }

  if (!evidence) {
    return recommendation(item, {
      action: "needs-evidence",
      command: null,
      heartbeat,
      priority: 55,
      reason: "human review item is missing Evidence",
    })
  }

  if (isRemoteEvidence(evidence)) {
    return recommendation(item, {
      action: "open-pr",
      command: commandWithIssue({ command: "open-pr", issueNumber: item.issue.number, repository }),
      heartbeat,
      priority: 60,
      reason: "published evidence exists and no PR is linked",
    })
  }

  return recommendation(item, {
    action: "publish-evidence",
    command: commandWithIssue({
      command: "publish-evidence",
      issueNumber: item.issue.number,
      repository,
    }),
    heartbeat,
    priority: 60,
    reason: "local evidence should be published before opening a PR",
  })
}

function browserEvidenceRecommendation(item, { heartbeat, repository }) {
  const state = item.fields["Agent State"]
  if (
    !requiresBrowserEvidence(item) ||
    browserEvidenceCovered(item.fields.Evidence) ||
    !item.fields.Workspace
  ) {
    return null
  }

  if (!["Changes Requested", "CI Repair", "Human Review", "Running"].includes(state)) {
    return null
  }

  return recommendation(item, {
    action: "capture-browser",
    command: commandWithIssue({
      command: "capture-browser",
      extraArgs: ['--dev-server-command "<dev-server-command>"'],
      issueNumber: item.issue.number,
      repository,
    }),
    heartbeat,
    priority: state === "Human Review" ? 54 : 35,
    reason: "UI-labeled work needs browser evidence before handoff",
  })
}

function browserEvidenceCovered(evidence) {
  return ["browser-artifacts", "evidence-packet"].includes(browserEvidenceReferenceKind(evidence))
}

function recommendation(item, { action, command, heartbeat = null, priority, reason }) {
  return {
    action,
    command,
    heartbeat,
    issue: item.issue,
    priority,
    reason,
    state: item.fields["Agent State"] ?? null,
  }
}

function isRemoteEvidence(evidence) {
  return /^https?:\/\//.test(evidence)
}

function commandWithIssue({ command, extraArgs = [], issueNumber, mutate = true, repository }) {
  return [
    `pnpm agent:queue:${command} -- --issue ${issueNumber}`,
    repository ? `--repo ${repository}` : null,
    ...extraArgs,
    mutate ? "--yes" : null,
  ]
    .filter(Boolean)
    .join(" ")
}

function commandWithRepo({ command, repository }) {
  return [`pnpm agent:queue:${command}`, repository ? `-- --repo ${repository}` : null]
    .filter(Boolean)
    .join(" ")
}
