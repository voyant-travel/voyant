import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  appendAgentRunnerEvent,
  defaultEventLogPath,
  recommendationEventDetails,
  resolveEventLogPath,
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
})
