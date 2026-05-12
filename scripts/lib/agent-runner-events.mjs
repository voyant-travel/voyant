import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
} from "node:fs"
import path from "node:path"

export const defaultEventLogPath = ".agent-runs/events.jsonl"
const defaultEventLogTailBytes = 256 * 1024

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

export function readAgentRunnerEvents(
  eventLogPath,
  { limit = 20, maxBytes = defaultEventLogTailBytes } = {},
) {
  const normalizedLimit = normalizeEventLimit(limit)
  if (!existsSync(eventLogPath) || normalizedLimit === 0) return []

  const tail = readEventLogTail(eventLogPath, { maxBytes })
  const lines = tail.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (tail.truncated) lines.shift()

  return lines.slice(-normalizedLimit).map((line) => parseEventLine(line))
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

function normalizeEventLimit(limit) {
  const normalized = Number(limit)
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new Error(`agent runner event limit must be a non-negative integer: ${String(limit)}`)
  }
  return normalized
}

function readEventLogTail(eventLogPath, { maxBytes }) {
  const normalizedMaxBytes = normalizeTailBytes(maxBytes)
  const stats = statSync(eventLogPath)
  if (stats.size === 0 || normalizedMaxBytes === 0) {
    return { text: "", truncated: stats.size > 0 }
  }

  const byteLength = Math.min(stats.size, normalizedMaxBytes)
  const start = stats.size - byteLength
  const buffer = Buffer.alloc(byteLength)
  const fd = openSync(eventLogPath, "r")

  try {
    readSync(fd, buffer, 0, byteLength, start)
  } finally {
    closeSync(fd)
  }

  return {
    text: buffer.toString("utf8"),
    truncated: start > 0,
  }
}

function normalizeTailBytes(maxBytes) {
  const normalized = Number(maxBytes)
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new Error(
      `agent runner event tail bytes must be a non-negative integer: ${String(maxBytes)}`,
    )
  }
  return normalized
}

function parseEventLine(line) {
  const event = JSON.parse(line)
  if (!event?.type) {
    throw new Error("agent runner event log line is missing type")
  }
  return event
}
