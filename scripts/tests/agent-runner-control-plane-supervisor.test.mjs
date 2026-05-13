import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import { buildLatestDispatchIntentRequest } from "../lib/agent-runner-control-plane-tick.mjs"
import { runLeasedDispatchIntent } from "../lib/agent-runner-dispatch-intent-runner.mjs"

describe("agent runner control plane supervisor helpers", () => {
  it("builds latest dispatch intent requests with filters, lease, and command options", () => {
    assert.deepEqual(
      buildLatestDispatchIntentRequest({
        action: "sync-pr",
        ciRepairCommand: "pnpm verify:fast",
        eventLog: ".agent-runs/supervisor.jsonl",
        holder: "supervisor:local",
        issue: "579",
        repository: "voyantjs/voyant",
        ttlSeconds: "600",
        updateBody: true,
      }),
      {
        filters: {
          action: "sync-pr",
          issueNumber: 579,
        },
        lease: {
          holder: "supervisor:local",
          ttlSeconds: 600,
        },
        options: {
          ciRepairCommand: "pnpm verify:fast",
          eventLog: ".agent-runs/supervisor.jsonl",
          updateBody: true,
        },
        repository: "voyantjs/voyant",
      },
    )
  })

  it("runs leased dispatch intents and finishes them with terminal status", async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "agent-control-plane-supervisor-"))
    const eventLogPath = path.join(tmp, "events.jsonl")
    const finishCalls = []

    try {
      const result = await runLeasedDispatchIntent({
        config: {
          token: "tok",
          url: "https://control.example.com",
        },
        eventLogPath,
        finishDispatchIntent: async (call) => {
          finishCalls.push(call)
          return {
            intent: {
              ...dispatchIntent(),
              resolution: {
                finishedAt: "2026-05-12T12:05:00.000Z",
                holder: "supervisor:local",
              },
              status: "completed",
            },
          }
        },
        holder: "supervisor:local",
        intent: dispatchIntent(),
        log: () => {},
        repository: "voyantjs/voyant",
        requestLatestDispatchIntentResult: {
          intent: dispatchIntent(),
          reason: "leased",
        },
        runDispatchIntentCommandImpl: () => 0,
      })

      assert.equal(result.status, 0)
      assert.equal(result.terminalStatus, "completed")
      assert.deepEqual(finishCalls, [
        {
          id: "intent_579",
          request: {
            exitCode: 0,
            holder: "supervisor:local",
            reason: "command completed",
            status: "completed",
          },
          token: "tok",
          url: "https://control.example.com",
        },
      ])

      const events = readFileSync(eventLogPath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
      assert.deepEqual(
        events.map((event) => event.type),
        [
          "dispatch-intent.quality_gate_passed",
          "dispatch-intent.started",
          "dispatch-intent.finished",
        ],
      )
    } finally {
      rmSync(tmp, { force: true, recursive: true })
    }
  })

  it("records the computed command status when finishing an intent fails", async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "agent-control-plane-supervisor-"))
    const eventLogPath = path.join(tmp, "events.jsonl")

    try {
      await assert.rejects(
        runLeasedDispatchIntent({
          config: {
            token: "tok",
            url: "https://control.example.com",
          },
          eventLogPath,
          finishDispatchIntent: async () => {
            throw new Error("control plane unavailable")
          },
          holder: "supervisor:local",
          intent: dispatchIntent(),
          log: () => {},
          repository: "voyantjs/voyant",
          requestLatestDispatchIntentResult: {
            intent: dispatchIntent(),
            reason: "leased",
          },
          runDispatchIntentCommandImpl: () => 0,
        }),
        /control plane unavailable/,
      )

      const events = readFileSync(eventLogPath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
      assert.deepEqual(
        events.map((event) => event.type),
        [
          "dispatch-intent.quality_gate_passed",
          "dispatch-intent.started",
          "dispatch-intent.finish_failed",
        ],
      )
      assert.equal(events[2].status, 0)
      assert.equal(events[2].terminalStatus, "completed")
      assert.equal(events[2].error, "control plane unavailable")
    } finally {
      rmSync(tmp, { force: true, recursive: true })
    }
  })

  it("fails leased dispatch intents before execution when quality gates fail", async () => {
    const finishCalls = []
    const result = await runLeasedDispatchIntent({
      config: {
        token: "tok",
        url: "https://control.example.com",
      },
      finishDispatchIntent: async (call) => {
        finishCalls.push(call)
        return {
          intent: {
            ...placeholderDispatchIntent(),
            status: "failed",
          },
        }
      },
      holder: "supervisor:local",
      intent: placeholderDispatchIntent(),
      log: () => {},
      repository: "voyantjs/voyant",
      requestLatestDispatchIntentResult: {
        intent: placeholderDispatchIntent(),
        reason: "leased",
      },
      runDispatchIntentCommandImpl: () => {
        throw new Error("command should not run")
      },
    })

    assert.equal(result.status, 1)
    assert.equal(result.terminalStatus, "failed")
    assert.match(finishCalls[0].request.reason, /executor quality gate failed/)
  })
})

function dispatchIntent() {
  return {
    id: "intent_579",
    lease: {
      holder: "supervisor:local",
    },
    plan: {
      action: "start",
      command: [
        "pnpm",
        "agent:queue:start",
        "--",
        "--issue",
        "579",
        "--repo",
        "voyantjs/voyant",
        "--yes",
      ],
      issue: {
        number: 579,
        repository: "voyantjs/voyant",
        title: "Test issue",
        url: "https://github.com/voyantjs/voyant/issues/579",
      },
      reason: "ready",
      repository: "voyantjs/voyant",
      requiresMutation: true,
    },
    status: "leased",
  }
}

function placeholderDispatchIntent() {
  return {
    ...dispatchIntent(),
    plan: {
      ...dispatchIntent().plan,
      action: "run-command",
      command: [
        "pnpm",
        "agent:queue:run-command",
        "--",
        "--issue",
        "579",
        "--repo",
        "voyantjs/voyant",
        "--command",
        "<implementation-command>",
        "--yes",
      ],
    },
  }
}
