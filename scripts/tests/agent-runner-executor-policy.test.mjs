import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  evaluateExecutorQualityGate,
  executorQualityGateFailure,
} from "../lib/agent-runner-executor-policy.mjs"

describe("agent runner executor policy", () => {
  it("blocks leased implementation commands that still contain placeholders", () => {
    const gate = evaluateExecutorQualityGate(
      intent({
        action: "run-command",
        command: [
          "pnpm",
          "agent:queue:run-command",
          "--",
          "--issue",
          "579",
          "--repo",
          "voyant-travel/voyant",
          "--command",
          "<implementation-command>",
          "--yes",
        ],
      }),
      { eventLogPath: ".agent-runs/executor.jsonl" },
    )

    assert.equal(gate.ok, false)
    assert.deepEqual(gate.reasons, ["dispatch intent command still contains executor placeholders"])
    assert.match(executorQualityGateFailure(gate), /executor quality gate failed/)
  })

  it("accepts concrete implementation and browser commands", () => {
    assert.deepEqual(
      evaluateExecutorQualityGate(
        intent({
          action: "remote-run-command",
          command: [
            "pnpm",
            "agent:queue:remote-run-command",
            "--",
            "--issue",
            "579",
            "--repo",
            "voyant-travel/voyant",
            "--command",
            "pnpm verify:fast",
            "--yes",
          ],
        }),
        { eventLogPath: ".agent-runs/executor.jsonl" },
      ),
      {
        ok: true,
        reasons: [],
        warnings: [],
      },
    )

    assert.equal(
      evaluateExecutorQualityGate(
        intent({
          action: "remote-capture-browser",
          command: [
            "pnpm",
            "agent:queue:remote-capture-browser",
            "--",
            "--issue",
            "579",
            "--repo",
            "voyant-travel/voyant",
            "--dev-server-command",
            "pnpm dev",
            "--port",
            "3000",
            "--yes",
          ],
        }),
      ).ok,
      true,
    )
  })

  it("blocks remote browser capture without a concrete port", () => {
    const gate = evaluateExecutorQualityGate(
      intent({
        action: "remote-capture-browser",
        command: [
          "pnpm",
          "agent:queue:remote-capture-browser",
          "--",
          "--issue",
          "579",
          "--repo",
          "voyant-travel/voyant",
          "--dev-server-command",
          "pnpm dev",
          "--port",
          "<port>",
          "--yes",
        ],
      }),
    )

    assert.equal(gate.ok, false)
    assert.match(gate.reasons.join("; "), /placeholder/)
    assert.match(gate.reasons.join("; "), /--port 1..65535/)
  })
})

function intent({ action, command }) {
  return {
    id: "intent_579",
    lease: {
      holder: "executor:test",
    },
    plan: {
      action,
      command,
      issue: {
        number: 579,
        repository: "voyant-travel/voyant",
        title: "Test issue",
        url: "https://github.com/voyant-travel/voyant/issues/579",
      },
      repository: "voyant-travel/voyant",
    },
    status: "leased",
  }
}
