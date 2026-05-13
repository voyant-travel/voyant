import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  latestRunnerSupervisorTick,
  recentRunnerLedgerLeases,
  recentRunnerLedgerRuns,
  recentRunnerSupervisorLeases,
  recentRunnerSupervisorTicks,
} from "../lib/agent-runner-deployed-status.mjs"

describe("agent runner deployed status summaries", () => {
  it("summarizes latest and recent runner supervisor history", () => {
    const status = {
      supervisorTicks: {
        latest: runnerTick({
          id: "tick_latest",
          intentId: "intent_579",
          reason: "leased_dispatch_intent",
        }),
        recent: [
          runnerTick({
            id: "tick_recent",
            leased: false,
            reason: "no_dispatch_plan",
          }),
        ],
      },
      supervisorLeases: {
        recent: [
          {
            id: "lease_579",
            leasedAt: "2026-05-12T12:00:00.000Z",
            result: {
              intent: {
                id: "intent_579",
              },
              reason: "leased",
            },
          },
        ],
      },
      runLedger: {
        recentLeases: [
          {
            action: "remote-bootstrap",
            holder: "runner:cloudflare",
            id: "ledger_lease_579",
            intentId: "intent_579",
            issueNumber: 579,
            leasedAt: "2026-05-12T12:00:00.000Z",
            reason: "leased",
            status: "leased",
          },
        ],
        recentRuns: [
          {
            action: "remote-bootstrap",
            id: "intent_579",
            issueNumber: 579,
            lastHeartbeatAt: "2026-05-12T12:00:00.000Z",
            status: "leased",
            updatedAt: "2026-05-12T12:00:00.000Z",
          },
        ],
      },
    }

    assert.deepEqual(latestRunnerSupervisorTick(status), {
      id: "tick_latest",
      intentId: "intent_579",
      leased: true,
      reason: "leased_dispatch_intent",
      recordedAt: "2026-05-12T12:00:00.000Z",
    })
    assert.deepEqual(recentRunnerSupervisorTicks(status), [
      {
        id: "tick_recent",
        intentId: null,
        leased: false,
        reason: "no_dispatch_plan",
        recordedAt: "2026-05-12T12:00:00.000Z",
      },
    ])
    assert.deepEqual(recentRunnerSupervisorLeases(status), [
      {
        id: "lease_579",
        intentId: "intent_579",
        leasedAt: "2026-05-12T12:00:00.000Z",
        reason: "leased",
      },
    ])
    assert.deepEqual(recentRunnerLedgerRuns(status), [
      {
        action: "remote-bootstrap",
        id: "intent_579",
        issueNumber: 579,
        lastHeartbeatAt: "2026-05-12T12:00:00.000Z",
        status: "leased",
        updatedAt: "2026-05-12T12:00:00.000Z",
      },
    ])
    assert.deepEqual(recentRunnerLedgerLeases(status), [
      {
        action: "remote-bootstrap",
        holder: "runner:cloudflare",
        id: "ledger_lease_579",
        intentId: "intent_579",
        issueNumber: 579,
        leasedAt: "2026-05-12T12:00:00.000Z",
        reason: "leased",
        status: "leased",
      },
    ])
  })
})

function runnerTick({ id, intentId, leased = true, reason = "dry_run" } = {}) {
  return {
    id,
    recordedAt: "2026-05-12T12:00:00.000Z",
    result: {
      ...(intentId ? { intent: { id: intentId } } : {}),
      leased,
      reason,
    },
  }
}
