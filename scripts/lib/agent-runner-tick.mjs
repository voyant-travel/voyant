import {
  browserEvidenceReferenceKind,
  requiresBrowserEvidence,
} from "./agent-runner-browser-evidence.mjs"
import { localCiRepairRecommendationPlan } from "./agent-runner-ci-repair-recommendation.mjs"
import { evaluateHeartbeat } from "./agent-runner-output.mjs"
import { hasReviewRepairEvidence } from "./agent-runner-review.mjs"
import { remoteWorkspaceRecommendation } from "./agent-runner-tick-remote.mjs"

const runnableStates = new Set(["Planning", "Changes Requested", "CI Repair"])
const stalePreemptionStates = new Set(["Planning", "Running", "Changes Requested", "CI Repair"])
const watchedStates = new Set([...stalePreemptionStates, "Blocked", "Human Review"])

export function recommendQueueActions(
  items,
  {
    browserDevServerCommand,
    ciRepairDispatchEnabled = false,
    implementationCommand,
    maxAgeDays,
    remoteBrowserDevServerCommand,
    remoteBrowserPort,
    remoteImplementationCommand,
    repository,
  },
) {
  return items
    .map((item) =>
      recommendQueueAction(item, {
        browserDevServerCommand,
        ciRepairDispatchEnabled,
        implementationCommand,
        maxAgeDays,
        remoteBrowserDevServerCommand,
        remoteBrowserPort,
        remoteImplementationCommand,
        repository,
      }),
    )
    .filter((recommendation) => recommendation.action !== "ignore")
    .sort(
      (left, right) =>
        left.priority - right.priority || (left.issue?.number ?? 0) - (right.issue?.number ?? 0),
    )
}

export function recommendQueueAction(
  item,
  {
    browserDevServerCommand,
    ciRepairDispatchEnabled = false,
    implementationCommand,
    maxAgeDays,
    remoteBrowserDevServerCommand,
    remoteBrowserPort,
    remoteImplementationCommand,
    repository,
  },
) {
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

  if (
    item.issue.state === "CLOSED" &&
    item.fields.PR &&
    state !== "Done" &&
    state !== "Abandoned"
  ) {
    return recommendation(item, {
      action: "complete-pr",
      command: commandWithIssue({
        command: "complete-pr",
        issueNumber: item.issue.number,
        repository,
      }),
      heartbeat,
      priority: 45,
      reason: "closed issue with linked PR should be completed in the Project",
    })
  }

  if (stalePreemptionStates.has(state) && heartbeat?.stale) {
    return recommendation(item, {
      action: "inspect-stale",
      command: commandWithRepo({ command: "watchdog", repository }),
      heartbeat,
      priority: 10,
      reason: heartbeat.reason,
    })
  }

  const workspaceRecommendation = remoteWorkspaceRecommendation({
    item,
    ciRepairDispatchEnabled,
    heartbeat,
    remoteBrowserDevServerCommand,
    remoteBrowserPort,
    remoteImplementationCommand,
    repository,
  })
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

  const browserRecommendation = browserEvidenceRecommendation(item, {
    browserDevServerCommand,
    heartbeat,
    repository,
  })
  if (browserRecommendation) {
    return browserRecommendation
  }

  const ciRepairPlan = localCiRepairRecommendationPlan(item, { ciRepairDispatchEnabled })
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

  if (runnableStates.has(state)) {
    return recommendation(item, {
      action: "run-command",
      command: commandWithIssue({
        command: "run-command",
        extraArgs: ["--command", shellArg(implementationCommand ?? "<implementation-command>")],
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

function humanReviewRecommendation(item, { heartbeat, repository }) {
  const evidence = item.fields.Evidence
  const pr = item.fields.PR

  if (!evidence) {
    const browserRecommendation = browserEvidenceRecommendation(item, { heartbeat, repository })
    if (browserRecommendation) return browserRecommendation
  }

  if (pr) {
    if (!heartbeat?.stale) {
      return recommendation(item, {
        action: "wait-human-review",
        command: null,
        heartbeat,
        priority: 80,
        reason: "linked PR is awaiting human review",
      })
    }

    return recommendation(item, {
      action: "sync-pr",
      command: commandWithIssue({ command: "sync-pr", issueNumber: item.issue.number, repository }),
      heartbeat,
      priority: 50,
      reason: "stale linked PR should be synced back to the Project",
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

function browserEvidenceRecommendation(item, { browserDevServerCommand, heartbeat, repository }) {
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
      extraArgs: [
        "--dev-server-command",
        shellArg(browserDevServerCommand ?? "<dev-server-command>"),
      ],
      issueNumber: item.issue.number,
      repository,
    }),
    heartbeat,
    priority: state === "Human Review" ? 54 : 35,
    reason: "UI-labeled work needs browser evidence before handoff",
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

function commandWithRepo({ command, repository }) {
  return [`pnpm agent:queue:${command}`, repository ? `-- --repo ${repository}` : null]
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
