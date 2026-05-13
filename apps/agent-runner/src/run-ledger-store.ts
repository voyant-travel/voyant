import { z } from "zod"

export const agentRunnerLedgerRunSchema = z.object({
  action: z.string().nullable(),
  branch: z.string().nullable(),
  createdAt: z.string().datetime(),
  evidenceUrl: z.string().nullable(),
  id: z.string().trim().min(1),
  issueNumber: z.number().int().positive().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  prUrl: z.string().nullable(),
  repository: z.string().trim().min(1),
  status: z.string().trim().min(1),
  updatedAt: z.string().datetime(),
  workspace: z.string().nullable(),
})

export type AgentRunnerLedgerRun = z.infer<typeof agentRunnerLedgerRunSchema>

export const agentRunnerLedgerLeaseSchema = z.object({
  action: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  holder: z.string().nullable(),
  id: z.string().trim().min(1),
  intentId: z.string().nullable(),
  issueNumber: z.number().int().positive().nullable(),
  leasedAt: z.string().datetime(),
  reason: z.string().nullable(),
  repository: z.string().trim().min(1),
  runId: z.string().nullable(),
  status: z.string().trim().min(1),
})

export type AgentRunnerLedgerLease = z.infer<typeof agentRunnerLedgerLeaseSchema>

export interface AgentRunnerLedgerStatus {
  configured: boolean
  latestHeartbeatAt: string | null
  recentLeaseCount: number
  recentRunCount: number
  repository: string
  runCountsByStatus: Record<string, number>
}

export interface AgentRunnerLedgerStore {
  ensureSchema?(): Promise<void>
  getStatus(repository: string): Promise<AgentRunnerLedgerStatus>
  listRecentLeases(
    repository: string,
    options?: { limit?: number; since?: string },
  ): Promise<AgentRunnerLedgerLease[]>
  listRecentRuns(repository: string, options?: { limit?: number }): Promise<AgentRunnerLedgerRun[]>
  recordSupervisorLease(input: {
    leasedAt: string
    repository: string
    result?: unknown
    supervisorLeaseId: string
  }): Promise<void>
  recordSupervisorTick(input: {
    recordedAt: string
    repository: string
    result: unknown
  }): Promise<void>
}

export interface AgentRunnerD1Database {
  exec(sql: string): Promise<unknown>
  prepare(sql: string): AgentRunnerD1PreparedStatement
}

export interface AgentRunnerD1PreparedStatement {
  all<T = unknown>(): Promise<{ results?: T[] }>
  bind(...values: unknown[]): AgentRunnerD1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  run(): Promise<unknown>
}

export const agentRunnerLedgerSchemaSql = `
CREATE TABLE IF NOT EXISTS agent_runner_runs (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  status TEXT NOT NULL,
  workspace TEXT,
  branch TEXT,
  pr_url TEXT,
  evidence_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_heartbeat_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_runs_repository_updated_idx
  ON agent_runner_runs (repository, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runner_runs_repository_status_idx
  ON agent_runner_runs (repository, status);

CREATE TABLE IF NOT EXISTS agent_runner_leases (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  status TEXT NOT NULL,
  holder TEXT,
  leased_at TEXT NOT NULL,
  expires_at TEXT,
  finished_at TEXT,
  reason TEXT,
  intent_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_leases_repository_leased_idx
  ON agent_runner_leases (repository, leased_at DESC);

CREATE INDEX IF NOT EXISTS agent_runner_leases_repository_status_idx
  ON agent_runner_leases (repository, status);

CREATE TABLE IF NOT EXISTS agent_runner_events (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_events_repository_created_idx
  ON agent_runner_events (repository, created_at DESC);
`

export function createD1AgentRunnerLedgerStore({
  database,
  now = () => new Date(),
}: {
  database: AgentRunnerD1Database
  now?: () => Date
}): AgentRunnerLedgerStore {
  return {
    async ensureSchema() {
      await database.exec(agentRunnerLedgerSchemaSql)
    },

    async getStatus(repository) {
      const normalizedRepository = normalizeRepository(repository)
      const counts = await database
        .prepare(
          `SELECT status, COUNT(*) AS count
           FROM agent_runner_runs
           WHERE repository = ?
           GROUP BY status`,
        )
        .bind(normalizedRepository)
        .all<{ status: string; count: number }>()
      const latest = await database
        .prepare(
          `SELECT last_heartbeat_at AS latestHeartbeatAt
           FROM agent_runner_runs
           WHERE repository = ? AND last_heartbeat_at IS NOT NULL
           ORDER BY last_heartbeat_at DESC
           LIMIT 1`,
        )
        .bind(normalizedRepository)
        .first<{ latestHeartbeatAt: string }>()
      const runCount = await database
        .prepare(`SELECT COUNT(*) AS count FROM agent_runner_runs WHERE repository = ?`)
        .bind(normalizedRepository)
        .first<{ count: number }>()
      const leaseCount = await database
        .prepare(`SELECT COUNT(*) AS count FROM agent_runner_leases WHERE repository = ?`)
        .bind(normalizedRepository)
        .first<{ count: number }>()

      return {
        configured: true,
        latestHeartbeatAt: latest?.latestHeartbeatAt ?? null,
        recentLeaseCount: Number(leaseCount?.count ?? 0),
        recentRunCount: Number(runCount?.count ?? 0),
        repository: normalizedRepository,
        runCountsByStatus: Object.fromEntries(
          (counts.results ?? []).map((row) => [row.status, Number(row.count)]),
        ),
      }
    },

    async listRecentLeases(repository, options = {}) {
      const normalizedRepository = normalizeRepository(repository)
      const limit = boundedLimit(options.limit)
      const rows = await database
        .prepare(
          `SELECT
             id,
             run_id AS runId,
             repository,
             issue_number AS issueNumber,
             action,
             status,
             holder,
             leased_at AS leasedAt,
             expires_at AS expiresAt,
             finished_at AS finishedAt,
             reason,
             intent_id AS intentId
           FROM agent_runner_leases
           WHERE repository = ? AND (? IS NULL OR leased_at >= ?)
           ORDER BY leased_at DESC
           LIMIT ?`,
        )
        .bind(normalizedRepository, options.since ?? null, options.since ?? null, limit)
        .all<AgentRunnerLedgerLease>()

      return (rows.results ?? []).map((row) => agentRunnerLedgerLeaseSchema.parse(row))
    },

    async listRecentRuns(repository, options = {}) {
      const normalizedRepository = normalizeRepository(repository)
      const rows = await database
        .prepare(
          `SELECT
             id,
             repository,
             issue_number AS issueNumber,
             action,
             status,
             workspace,
             branch,
             pr_url AS prUrl,
             evidence_url AS evidenceUrl,
             created_at AS createdAt,
             updated_at AS updatedAt,
             last_heartbeat_at AS lastHeartbeatAt
           FROM agent_runner_runs
           WHERE repository = ?
           ORDER BY updated_at DESC
           LIMIT ?`,
        )
        .bind(normalizedRepository, boundedLimit(options.limit))
        .all<AgentRunnerLedgerRun>()

      return (rows.results ?? []).map((row) => agentRunnerLedgerRunSchema.parse(row))
    },

    async recordSupervisorLease(input) {
      const normalizedRepository = normalizeRepository(input.repository)
      const details = dispatchIntentDetails(input.result)
      const runId = details.intentId ?? input.supervisorLeaseId
      const updatedAt = now().toISOString()

      await database
        .prepare(
          `INSERT INTO agent_runner_runs (
             id, repository, issue_number, action, status, created_at, updated_at,
             last_heartbeat_at, metadata_json
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             updated_at = excluded.updated_at,
             last_heartbeat_at = excluded.last_heartbeat_at,
             metadata_json = excluded.metadata_json`,
        )
        .bind(
          runId,
          normalizedRepository,
          details.issueNumber,
          details.action,
          "leased",
          input.leasedAt,
          updatedAt,
          updatedAt,
          json({
            source: "supervisor-lease",
            supervisorLeaseId: input.supervisorLeaseId,
          }),
        )
        .run()

      await database
        .prepare(
          `INSERT INTO agent_runner_leases (
             id, run_id, repository, issue_number, action, status, holder,
             leased_at, expires_at, finished_at, reason, intent_id, metadata_json
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             holder = excluded.holder,
             expires_at = excluded.expires_at,
             reason = excluded.reason,
             metadata_json = excluded.metadata_json`,
        )
        .bind(
          input.supervisorLeaseId,
          runId,
          normalizedRepository,
          details.issueNumber,
          details.action,
          "leased",
          details.holder,
          input.leasedAt,
          details.expiresAt,
          null,
          details.reason,
          details.intentId,
          json({
            source: "supervisor-lease",
          }),
        )
        .run()
    },

    async recordSupervisorTick(input) {
      const details = dispatchIntentDetails(input.result)
      const eventId = `tick_${Date.parse(input.recordedAt)}_${eventIdSuffix(input.recordedAt)}`
      await database
        .prepare(
          `INSERT INTO agent_runner_events (
             id, run_id, repository, issue_number, action, type, created_at, data_json
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
        )
        .bind(
          eventId,
          details.intentId,
          normalizeRepository(input.repository),
          details.issueNumber,
          details.action,
          "supervisor.tick",
          input.recordedAt,
          json({
            leased: details.leased,
            reason: details.reason,
          }),
        )
        .run()
    },
  }
}

export function createInMemoryAgentRunnerLedgerStore(): AgentRunnerLedgerStore {
  const leases = new Map<string, AgentRunnerLedgerLease>()
  const runs = new Map<string, AgentRunnerLedgerRun>()

  return {
    async getStatus(repository) {
      const normalizedRepository = normalizeRepository(repository)
      const matchingRuns = Array.from(runs.values()).filter(
        (run) => run.repository === normalizedRepository,
      )
      const matchingLeases = Array.from(leases.values()).filter(
        (lease) => lease.repository === normalizedRepository,
      )
      return {
        configured: true,
        latestHeartbeatAt: latest(
          matchingRuns
            .map((run) => run.lastHeartbeatAt)
            .filter((value): value is string => !!value),
        ),
        recentLeaseCount: matchingLeases.length,
        recentRunCount: matchingRuns.length,
        repository: normalizedRepository,
        runCountsByStatus: matchingRuns.reduce<Record<string, number>>((counts, run) => {
          counts[run.status] = (counts[run.status] ?? 0) + 1
          return counts
        }, {}),
      }
    },

    async listRecentLeases(repository, options = {}) {
      const normalizedRepository = normalizeRepository(repository)
      return Array.from(leases.values())
        .filter((lease) => lease.repository === normalizedRepository)
        .filter((lease) => !options.since || lease.leasedAt >= options.since)
        .sort((a, b) => b.leasedAt.localeCompare(a.leasedAt))
        .slice(0, boundedLimit(options.limit))
    },

    async listRecentRuns(repository, options = {}) {
      const normalizedRepository = normalizeRepository(repository)
      return Array.from(runs.values())
        .filter((run) => run.repository === normalizedRepository)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, boundedLimit(options.limit))
    },

    async recordSupervisorLease(input) {
      const normalizedRepository = normalizeRepository(input.repository)
      const details = dispatchIntentDetails(input.result)
      const runId = details.intentId ?? input.supervisorLeaseId
      const updatedAt = new Date().toISOString()

      runs.set(runId, {
        action: details.action,
        branch: null,
        createdAt: input.leasedAt,
        evidenceUrl: null,
        id: runId,
        issueNumber: details.issueNumber,
        lastHeartbeatAt: updatedAt,
        prUrl: null,
        repository: normalizedRepository,
        status: "leased",
        updatedAt,
        workspace: null,
      })
      leases.set(input.supervisorLeaseId, {
        action: details.action,
        expiresAt: details.expiresAt,
        finishedAt: null,
        holder: details.holder,
        id: input.supervisorLeaseId,
        intentId: details.intentId,
        issueNumber: details.issueNumber,
        leasedAt: input.leasedAt,
        reason: details.reason,
        repository: normalizedRepository,
        runId,
        status: "leased",
      })
    },

    async recordSupervisorTick() {},
  }
}

function boundedLimit(limit = 20) {
  return Math.min(Math.max(Math.trunc(limit), 1), 100)
}

function dispatchIntentDetails(result: unknown) {
  const object = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  const intent = firstRecord(object.intent, object.activeIntent)
  const plan = firstRecord(intent?.plan)
  const issue = firstRecord(plan?.issue)
  const lease = firstRecord(intent?.lease)

  return {
    action: stringOrNull(plan?.action),
    expiresAt: stringOrNull(lease?.expiresAt),
    holder: stringOrNull(lease?.holder),
    intentId: stringOrNull(intent?.id),
    issueNumber: numberOrNull(issue?.number),
    leased: object.leased === true,
    reason: stringOrNull(object.reason),
  }
}

function eventIdSuffix(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

function firstRecord(...values: unknown[]) {
  return values.find(
    (value): value is Record<string, unknown> => !!value && typeof value === "object",
  )
}

function json(value: unknown) {
  return JSON.stringify(value)
}

function latest(values: string[]) {
  return values.sort().at(-1) ?? null
}

function normalizeRepository(repository: string) {
  return repository.trim().toLowerCase()
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}
