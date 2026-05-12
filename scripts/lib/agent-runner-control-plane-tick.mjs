import fs from "node:fs"

import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  projectScanConfigFromArgs,
} from "./agent-project-queue.mjs"
import { readAgentRunnerEvents, resolveEventLogPath } from "./agent-runner-events.mjs"
import { recommendQueueActions } from "./agent-runner-tick.mjs"

export function generateControlPlaneTickSnapshot(args, { repoRoot }) {
  const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
  const maxAgeDays = Number(args.maxAgeDays ?? 1)
  const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
  const recentEventLimit = numberArg(args.recentEvents, "recent-events", 5, { min: 0 })

  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
    fail(`invalid max age days: ${String(args.maxAgeDays)}`)
  }

  const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
  const items = filterItemsByRepository(project.items, repository)

  return {
    project: {
      owner: project.owner,
      number: project.projectNumber,
      title: project.projectTitle,
      url: project.projectUrl,
    },
    repository,
    maxAgeDays,
    eventLog: {
      path: eventLogPath,
      recentEvents: readRecentEvents(eventLogPath, recentEventLimit),
    },
    recommendations: recommendQueueActions(items, { maxAgeDays, repository }),
  }
}

export function readControlPlaneTickSnapshotInput(input) {
  const text = input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(input, "utf8")
  try {
    return JSON.parse(text)
  } catch (error) {
    fail(`invalid tick snapshot JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function buildLatestDispatchIntentRequest({
  action,
  eventLog,
  holder,
  issue,
  repository,
  ttlSeconds,
  updateBody,
}) {
  const issueNumber = optionalPositiveInteger(issue, "issue")
  const leaseTtlSeconds = optionalInteger(ttlSeconds, "ttl-seconds", { max: 3600, min: 60 })

  return {
    repository,
    lease: {
      holder,
      ...(leaseTtlSeconds ? { ttlSeconds: leaseTtlSeconds } : {}),
    },
    ...(issueNumber || action
      ? {
          filters: {
            ...(action ? { action } : {}),
            ...(issueNumber ? { issueNumber } : {}),
          },
        }
      : {}),
    ...(eventLog || updateBody
      ? {
          options: {
            ...(eventLog ? { eventLog } : {}),
            ...(updateBody ? { updateBody: true } : {}),
          },
        }
      : {}),
  }
}

function readRecentEvents(eventLogPath, limit) {
  try {
    return readAgentRunnerEvents(eventLogPath, { limit })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function optionalPositiveInteger(value, name) {
  return optionalInteger(value, name, { min: 1 })
}

function optionalInteger(value, name, { max = Number.POSITIVE_INFINITY, min = 1 } = {}) {
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

function numberArg(value, name, fallback, { min = 1 } = {}) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < min) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}
