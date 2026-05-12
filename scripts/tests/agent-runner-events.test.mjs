import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  appendAgentRunnerEvent,
  defaultEventLogPath,
  issueEventDetails,
  readAgentRunnerEvents,
  recommendationEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "../lib/agent-runner-events.mjs"
import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner event helpers", () => {
  it("resolves the default event log under the repository root", () => {
    assert.equal(
      resolveEventLogPath(undefined, { repoRoot: "/repo" }),
      path.join("/repo", defaultEventLogPath),
    )
    assert.equal(
      resolveEventLogPath("/tmp/events.jsonl", { repoRoot: "/repo" }),
      "/tmp/events.jsonl",
    )
  })

  it("appends JSONL events with timestamps", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-runner-events-"))
    const eventLogPath = path.join(tempDir, "nested", "events.jsonl")

    const entry = appendAgentRunnerEvent({
      eventLogPath,
      event: {
        type: "dispatch.started",
        repository: "voyantjs/voyant",
      },
      now: new Date("2026-05-10T12:00:00.000Z"),
    })

    assert.deepEqual(entry, {
      timestamp: "2026-05-10T12:00:00.000Z",
      type: "dispatch.started",
      repository: "voyantjs/voyant",
    })
    assert.equal(`${JSON.stringify(entry)}\n`, readFileSync(eventLogPath, "utf8"))
  })

  it("can treat event log write failures as non-fatal", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-runner-events-"))
    const eventLogParent = path.join(tempDir, "event-parent")
    const eventLogPath = path.join(eventLogParent, "events.jsonl")
    const warnings = []

    writeFileSync(eventLogParent, "not a directory", "utf8")

    const entry = tryAppendAgentRunnerEvent({
      eventLogPath,
      event: {
        type: "claim.completed",
        repository: "voyantjs/voyant",
      },
      warn: (message) => warnings.push(message),
    })

    assert.equal(entry, null)
    assert.match(warnings[0], /agent-runner event log warning:/)
  })

  it("reads a bounded tail of JSONL runner events", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-runner-events-"))
    const eventLogPath = path.join(tempDir, "events.jsonl")

    writeFileSync(
      eventLogPath,
      [
        JSON.stringify({ timestamp: "2026-05-10T12:00:00.000Z", type: "one" }),
        "",
        JSON.stringify({ timestamp: "2026-05-10T12:01:00.000Z", type: "two" }),
        JSON.stringify({ timestamp: "2026-05-10T12:02:00.000Z", type: "three" }),
      ].join("\n"),
      "utf8",
    )

    assert.deepEqual(readAgentRunnerEvents(eventLogPath, { limit: 2 }), [
      { timestamp: "2026-05-10T12:01:00.000Z", type: "two" },
      { timestamp: "2026-05-10T12:02:00.000Z", type: "three" },
    ])
    assert.deepEqual(readAgentRunnerEvents(eventLogPath, { limit: 0 }), [])
    assert.deepEqual(readAgentRunnerEvents(path.join(tempDir, "missing.jsonl")), [])
  })

  it("does not parse historical event lines outside the bounded tail", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-runner-events-"))
    const eventLogPath = path.join(tempDir, "events.jsonl")
    const historicalLine = `${JSON.stringify({ timestamp: "2026-05-10T12:00:00.000Z" })}${"x".repeat(200)}`
    const recentEvents = [
      { timestamp: "2026-05-10T12:01:00.000Z", type: "two" },
      { timestamp: "2026-05-10T12:02:00.000Z", type: "three" },
    ]

    writeFileSync(
      eventLogPath,
      [historicalLine, ...recentEvents.map((event) => JSON.stringify(event))].join("\n"),
      "utf8",
    )

    assert.deepEqual(readAgentRunnerEvents(eventLogPath, { limit: 2, maxBytes: 150 }), recentEvents)
  })

  it("extracts stable recommendation details for logs", () => {
    const recommendation = recommendQueueAction(workItem({ number: 579 }), {
      maxAgeDays: 1,
      repository: "voyantjs/voyant",
    })

    assert.deepEqual(recommendationEventDetails(recommendation), {
      action: "start",
      reason: "maintainer-approved item is ready to claim",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyantjs/voyant/issues/579",
        repository: "voyantjs/voyant",
      },
    })
  })

  it("extracts stable issue details for command events", () => {
    const item = workItem({ number: 579 })

    assert.deepEqual(issueEventDetails(item), {
      number: 579,
      title: "Test agent project intake workflow",
      url: "https://github.com/voyantjs/voyant/issues/579",
      repository: "voyantjs/voyant",
    })
    assert.deepEqual(issueEventDetails(item.issue), issueEventDetails(item))
  })

  it("rejects events without a type", () => {
    assert.throws(
      () =>
        appendAgentRunnerEvent({
          eventLogPath: path.join(tmpdir(), "unused-events.jsonl"),
          event: {},
        }),
      /agent runner event requires a type/,
    )
  })

  it("rejects invalid event read limits and missing event types", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-runner-events-"))
    const eventLogPath = path.join(tempDir, "events.jsonl")
    writeFileSync(eventLogPath, `${JSON.stringify({ timestamp: "2026-05-10T12:00:00.000Z" })}\n`)

    assert.throws(
      () => readAgentRunnerEvents(eventLogPath, { limit: "x" }),
      /agent runner event limit must be a non-negative integer: x/,
    )
    assert.throws(
      () => readAgentRunnerEvents(eventLogPath),
      /agent runner event log line is missing type/,
    )
  })
})
