import type { AgentRunnerLedgerStore } from "./run-ledger-store.js"
import type { SupervisorTickStore } from "./supervisor-tick-store.js"

export function supervisorTickCapabilities(supervisorTickStore: SupervisorTickStore | undefined) {
  return {
    history: Boolean(supervisorTickStore),
    leaseBudgetHistory: Boolean(supervisorTickStore?.listLeases && supervisorTickStore.putLease),
    persistence: supervisorTickStore ? "latest" : "none",
  }
}

export function runLedgerCapabilities(runLedgerStore: AgentRunnerLedgerStore | undefined) {
  return {
    configured: Boolean(runLedgerStore),
    persistence: runLedgerStore ? "d1" : "none",
  }
}

export function coordinatorCapabilities(coordinatorConfigured: boolean) {
  return {
    configured: coordinatorConfigured,
    mode: coordinatorConfigured ? "durable-object" : "none",
  }
}

export async function readRunLedgerStatus({
  limit,
  repository,
  runLedgerStore,
}: {
  limit: number
  repository: string
  runLedgerStore?: AgentRunnerLedgerStore
}) {
  if (!runLedgerStore) {
    return {
      recentLeases: [],
      recentRuns: [],
      status: {
        configured: false,
        latestHeartbeatAt: null,
        recentLeaseCount: 0,
        recentRunCount: 0,
        repository,
        runCountsByStatus: {},
      },
      storage: {
        configured: false,
        persistence: "none",
      },
    }
  }

  return {
    recentLeases: await runLedgerStore.listRecentLeases(repository, { limit }),
    recentRuns: await runLedgerStore.listRecentRuns(repository, { limit }),
    status: await runLedgerStore.getStatus(repository),
    storage: {
      configured: true,
      persistence: "d1",
    },
  }
}
