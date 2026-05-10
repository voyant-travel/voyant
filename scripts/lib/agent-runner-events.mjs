import { appendFileSync, mkdirSync } from "node:fs"
import path from "node:path"

export const defaultEventLogPath = ".agent-runs/events.jsonl"

export function resolveEventLogPath(value, { repoRoot = process.cwd() } = {}) {
  const eventLogPath = value ?? defaultEventLogPath
  return path.isAbsolute(eventLogPath) ? eventLogPath : path.join(repoRoot, eventLogPath)
}

export function appendAgentRunnerEvent({ event, eventLogPath, now = new Date() }) {
  const entry = normalizeEvent(event, { now })
  mkdirSync(path.dirname(eventLogPath), { recursive: true })
  appendFileSync(eventLogPath, `${JSON.stringify(entry)}\n`, "utf8")
  return entry
}

export function recommendationEventDetails(recommendation) {
  return {
    action: recommendation.action,
    reason: recommendation.reason,
    issue: {
      number: recommendation.issue.number,
      title: recommendation.issue.title,
      url: recommendation.issue.url,
      repository: recommendation.issue.repository,
    },
  }
}

function normalizeEvent(event, { now }) {
  if (!event?.type) {
    throw new Error("agent runner event requires a type")
  }

  return {
    timestamp: now.toISOString(),
    ...event,
  }
}
