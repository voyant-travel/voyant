import {
  browserEvidenceReferenceKind,
  requiresBrowserEvidence,
} from "./agent-runner-browser-evidence.mjs"
import { hasCiRepairEvidence } from "./agent-runner-ci.mjs"
import { remoteCiRepairCommandPlan } from "./agent-runner-ci-repair-recommendation.mjs"
import { hasReviewRepairEvidence } from "./agent-runner-review.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./agent-runner-workspace-contract.mjs"

export function remoteWorkspaceRecommendation({
  item,
  ciRepairDispatchEnabled,
  heartbeat,
  remoteBrowserDevServerCommand,
  remoteBrowserPort,
  remoteImplementationCommand,
  repository,
}) {
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

  const remoteBrowserRecommendation = remoteBrowserEvidenceRecommendation(item, {
    descriptor,
    heartbeat,
    remoteBrowserDevServerCommand,
    remoteBrowserPort,
    repository,
  })
  if (remoteBrowserRecommendation) return remoteBrowserRecommendation

  if (state === "Human Review" && item.fields.PR) return null
  if (state === "Merge Ready" && item.fields.PR) return null

  if (state === "Human Review" && item.fields.Evidence) {
    return remoteHumanReviewRecommendation(item, { descriptor, heartbeat, repository })
  }

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

  const reviewRepairPlan = reviewRepairRecommendationPlan(item)
  if (reviewRepairPlan) {
    return recommendation(item, {
      action: reviewRepairPlan.action,
      command: commandWithIssue({
        command: reviewRepairPlan.command,
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: reviewRepairPlan.priority,
      reason: reviewRepairPlan.reason,
    })
  }

  const ciRepairPlan = remoteCiRepairCommandPlan(item, {
    ciRepairDispatchEnabled,
    workspaceReference: descriptor.reference,
  })
  if (ciRepairPlan) {
    return recommendation(item, {
      action: ciRepairPlan.action,
      command: commandWithIssue({
        command: ciRepairPlan.command,
        extraArgs: ciRepairPlan.extraArgs,
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: ciRepairPlan.priority,
      reason: ciRepairPlan.reason,
    })
  }

  if (["Planning", "Changes Requested", "CI Repair"].includes(state)) {
    return recommendation(item, {
      action: "remote-run-command",
      command: commandWithIssue({
        command: "remote-run-command",
        extraArgs: [
          "--command",
          shellArg(remoteImplementationCommand ?? "<implementation-command>"),
        ],
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
      action: "remote-cleanup",
      command: commandWithIssue({
        command: "remote-cleanup",
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 90,
      reason: `remote workspace ${descriptor.reference} needs remote adapter cleanup`,
    })
  }

  if (remoteAdapterNeeded(state, item.ready)) {
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

function remoteHumanReviewRecommendation(item, { descriptor, heartbeat, repository }) {
  if (isRemoteEvidence(item.fields.Evidence)) {
    return recommendation(item, {
      action: "remote-open-pr",
      command: commandWithIssue({
        command: "remote-open-pr",
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 60,
      reason: `remote workspace ${descriptor.reference} has published evidence and needs a PR`,
    })
  }

  return recommendation(item, {
    action: "remote-publish-evidence",
    command: commandWithIssue({
      command: "remote-publish-evidence",
      issueNumber: item.issue.number,
      repository,
    }),
    heartbeat,
    priority: 60,
    reason: `remote workspace ${descriptor.reference} evidence should be published before PR creation`,
  })
}

function remoteBrowserEvidenceRecommendation(
  item,
  { descriptor, heartbeat, remoteBrowserDevServerCommand, remoteBrowserPort, repository },
) {
  const state = item.fields["Agent State"]
  if (
    !requiresBrowserEvidence(item) ||
    browserEvidenceCovered(item.fields.Evidence) ||
    !["Changes Requested", "CI Repair", "Human Review"].includes(state)
  ) {
    return null
  }

  return recommendation(item, {
    action: "remote-capture-browser",
    command: commandWithIssue({
      command: "remote-capture-browser",
      extraArgs: [
        "--dev-server-command",
        shellArg(remoteBrowserDevServerCommand ?? "<dev-server-command>"),
        "--port",
        shellArg(remoteBrowserPort ?? "<port>"),
      ],
      issueNumber: item.issue.number,
      repository,
    }),
    heartbeat,
    priority: state === "Human Review" ? 54 : 35,
    reason: `UI-labeled remote work in ${descriptor.reference} needs browser evidence before handoff`,
  })
}

function reviewRepairRecommendationPlan(item) {
  if (
    item.fields["Agent State"] !== "Changes Requested" ||
    !item.fields.PR ||
    hasReviewRepairEvidence(item.fields.Evidence)
  ) {
    return null
  }

  return {
    action: "collect-review",
    command: "collect-review",
    priority: 29,
    reason: "requested PR changes need a local review repair packet",
  }
}

function remoteAdapterNeeded(state, ready) {
  return (
    ["Ready", "Planning", "Running", "Changes Requested", "CI Repair", "Human Review"].includes(
      state,
    ) || ready
  )
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
    workspace: item.fields.Workspace ?? null,
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

function shellArg(value) {
  const normalized = String(value)
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(normalized)) {
    return normalized
  }

  return `"${normalized.replace(/(["\\$`])/g, "\\$1")}"`
}
