import { hasCiRepairEvidence } from "./agent-runner-ci.mjs"

export function localCiRepairRecommendationPlan(item, { ciRepairDispatchEnabled = false } = {}) {
  if (item.fields["Agent State"] !== "CI Repair") return null

  if (item.fields.PR && !hasCiRepairEvidence(item.fields.Evidence)) {
    return {
      action: "collect-ci",
      command: "collect-ci",
      priority: 28,
      reason: "failing PR checks need a local CI repair packet",
    }
  }

  return ciRepairCommandPlan({ ciRepairDispatchEnabled })
}

export function remoteCiRepairCommandPlan(
  item,
  { ciRepairDispatchEnabled = false, workspaceReference } = {},
) {
  if (item.fields["Agent State"] !== "CI Repair" || !hasCiRepairEvidence(item.fields.Evidence)) {
    return null
  }

  return ciRepairCommandPlan({ ciRepairDispatchEnabled, remote: true, workspaceReference })
}

function ciRepairCommandPlan({ ciRepairDispatchEnabled, remote = false, workspaceReference }) {
  if (ciRepairDispatchEnabled) {
    return {
      action: remote ? "remote-repair-ci" : "repair-ci",
      command: remote ? "remote-repair-ci" : "repair-ci",
      priority: 30,
      reason: remote
        ? `remote workspace ${workspaceReference} is ready for automatic CI repair`
        : "CI repair packet is ready for automatic repair",
    }
  }

  return {
    action: remote ? "remote-run-command" : "run-command",
    command: remote ? "remote-run-command" : "run-command",
    extraArgs: [
      remote ? '--command "<implementation-command>"' : '--command "<ci-repair-command>"',
    ],
    priority: 30,
    reason: remote
      ? `remote workspace ${workspaceReference} is ready for supervised command execution`
      : "CI repair packet is ready for a narrow repair command",
  }
}
