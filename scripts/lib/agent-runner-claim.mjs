import { updateProjectItemFields } from "./agent-project-fields.mjs"

export function claimFieldValues(item, date = new Date()) {
  return {
    Status: "In Progress",
    "Agent State": "Planning",
    Branch: item.dryRunPlan.branch,
    Workspace: item.dryRunPlan.workspace,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
}

export function claimProjectItem({ item, project, date }) {
  const values = claimFieldValues(item, date)
  updateProjectItemFields({ project, item, values })
  return values
}

export function printClaimUpdate({ action = "claim", item, repository, values }) {
  console.log(`agent-runner ${action} would update:`)
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
}
