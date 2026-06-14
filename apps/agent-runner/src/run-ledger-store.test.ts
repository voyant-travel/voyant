import { describe, expect, it } from "vitest"

import {
  type AgentRunnerD1Database,
  agentRunnerLedgerSchemaSql,
  createD1AgentRunnerLedgerStore,
  createInMemoryAgentRunnerLedgerStore,
} from "./run-ledger-store.js"

describe("agent runner run ledger store", () => {
  it("records supervisor leases and ticks in the in-memory ledger", async () => {
    const store = createInMemoryAgentRunnerLedgerStore()

    await store.recordSupervisorLease({
      leasedAt: "2026-05-12T12:00:00.000Z",
      repository: "Voyant-Travel/Voyant",
      result: leasedResult(),
      supervisorLeaseId: "lease_1",
    })
    await store.recordSupervisorTick({
      recordedAt: "2026-05-12T12:00:01.000Z",
      repository: "Voyant-Travel/Voyant",
      result: leasedResult(),
    })

    await expect(store.getStatus("voyant-travel/voyant")).resolves.toMatchObject({
      configured: true,
      recentLeaseCount: 1,
      recentRunCount: 1,
      repository: "voyant-travel/voyant",
      runCountsByStatus: {
        leased: 1,
      },
    })
    await expect(store.listRecentLeases("voyant-travel/voyant")).resolves.toMatchObject([
      {
        action: "sync-pr",
        holder: "runner:cloudflare",
        id: "lease_1",
        intentId: "intent_579",
        issueNumber: 579,
        repository: "voyant-travel/voyant",
        status: "leased",
      },
    ])
    await expect(store.listRecentRuns("voyant-travel/voyant")).resolves.toMatchObject([
      {
        action: "sync-pr",
        id: "intent_579",
        issueNumber: 579,
        repository: "voyant-travel/voyant",
        status: "leased",
      },
    ])
  })

  it("exposes the D1 schema and writes normalized ledger rows", async () => {
    const database = new FakeD1Database()
    const store = createD1AgentRunnerLedgerStore({
      database,
      now: () => new Date("2026-05-12T12:00:02.000Z"),
    })

    await store.ensureSchema?.()
    await store.recordSupervisorLease({
      leasedAt: "2026-05-12T12:00:00.000Z",
      repository: "Voyant-Travel/Voyant",
      result: leasedResult(),
      supervisorLeaseId: "lease_1",
    })
    await store.recordSupervisorTick({
      recordedAt: "2026-05-12T12:00:01.000Z",
      repository: "Voyant-Travel/Voyant",
      result: leasedResult(),
    })

    expect(database.execCalls).toEqual([agentRunnerLedgerSchemaSql])
    expect(database.runCalls).toHaveLength(3)
    expect(database.runCalls[0]?.values).toEqual(
      expect.arrayContaining(["intent_579", "voyant-travel/voyant", 579, "sync-pr", "leased"]),
    )
    expect(database.runCalls[1]?.values).toEqual(
      expect.arrayContaining([
        "lease_1",
        "intent_579",
        "voyant-travel/voyant",
        "runner:cloudflare",
      ]),
    )
    expect(database.runCalls[2]?.values).toEqual(
      expect.arrayContaining(["intent_579", "voyant-travel/voyant", 579, "sync-pr"]),
    )
  })
})

function leasedResult() {
  return {
    intent: {
      id: "intent_579",
      lease: {
        expiresAt: "2026-05-12T12:15:00.000Z",
        holder: "runner:cloudflare",
      },
      plan: {
        action: "sync-pr",
        issue: {
          number: 579,
        },
      },
    },
    leased: true,
    reason: "leased",
  }
}

class FakeD1Database implements AgentRunnerD1Database {
  execCalls: string[] = []
  runCalls: Array<{ sql: string; values: unknown[] }> = []

  async exec(sql: string) {
    this.execCalls.push(sql)
  }

  prepare(sql: string) {
    return new FakeD1PreparedStatement(sql, this)
  }
}

class FakeD1PreparedStatement {
  private values: unknown[] = []

  constructor(
    private readonly sql: string,
    private readonly database: FakeD1Database,
  ) {}

  async all<T = unknown>(): Promise<{ results?: T[] }> {
    return { results: [] }
  }

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    return null
  }

  async run() {
    this.database.runCalls.push({
      sql: this.sql,
      values: this.values,
    })
  }
}
