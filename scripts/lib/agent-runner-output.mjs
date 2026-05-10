import { fail } from "./agent-project-queue.mjs"

export function projectSummaryJson(project) {
  return {
    project: {
      owner: project.owner,
      number: project.projectNumber,
      title: project.projectTitle,
      url: project.projectUrl,
    },
    readyCount: project.readyItems.length,
    totalCount: project.items.length,
    items: project.items,
  }
}

export function evaluateHeartbeat(value, { maxAgeDays }) {
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
    fail(`invalid max age days: ${String(maxAgeDays)}`)
  }

  if (!value) {
    return { reason: "Last Heartbeat is unset", stale: true }
  }

  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) {
    return { reason: `Last Heartbeat is invalid: ${value}`, stale: true }
  }

  const ageDays = Math.floor((startOfTodayUtc() - parsed) / 86_400_000)
  return {
    reason: `Last Heartbeat is ${ageDays} days old`,
    stale: ageDays > maxAgeDays,
  }
}

export function printHumanSummary(project) {
  console.log(
    `agent-runner dry run: ${project.projectTitle} (${project.owner}/projects/${project.projectNumber})`,
  )
  console.log(`items scanned: ${project.items.length}`)
  console.log(`ready items: ${project.readyItems.length}`)
  console.log("")

  if (project.readyItems.length > 0) {
    console.log("Ready items:")
    for (const item of project.readyItems) {
      const issue = item.issue
      console.log(`- #${issue.number} ${issue.title}`)
      console.log(`  url: ${issue.url}`)
      console.log(`  branch: ${item.dryRunPlan.branch}`)
      console.log(`  workspace: ${item.dryRunPlan.workspace}`)
      console.log(`  plan: ${item.dryRunPlan.planPath}`)
      console.log(`  verification: ${item.dryRunPlan.verificationLane}`)
      console.log("")
    }
  }

  const blockedItems = project.items.filter((item) => !item.ready)
  if (blockedItems.length > 0) {
    console.log("Blocked or ignored items:")
    for (const item of blockedItems) {
      const title = item.issue ? `#${item.issue.number} ${item.issue.title}` : item.itemId
      console.log(`- ${title}`)
      for (const reason of item.reasons) {
        console.log(`  - ${reason}`)
      }
    }
  }
}

function startOfTodayUtc() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}
