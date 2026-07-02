import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type SourceConnection, type SourceConnectionStatus, sourceConnections } from "./schema.js"
import {
  type CreateSourceConnectionDraftInput,
  createSourceConnectionDraftSchema,
  type DisconnectSourceConnectionInput,
  disconnectSourceConnectionSchema,
  type PauseSourceConnectionInput,
  pauseSourceConnectionSchema,
  type ResumeSourceConnectionInput,
  resumeSourceConnectionSchema,
  type SourceConnectionListQuery,
  sourceConnectionListQuerySchema,
} from "./validation.js"

export interface SourceConnectionListResult {
  data: SourceConnection[]
  total: number
  limit: number
  offset: number
}

export class SourceConnectionLifecycleError extends Error {
  readonly code = "invalid_source_connection_transition"
  readonly status = 409

  constructor(
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message)
    this.name = "SourceConnectionLifecycleError"
  }
}

const secretKeyPattern =
  /(api[_-]?key|authorization|client[_-]?secret|password|private[_-]?key|refresh[_-]?token|secret|token)/i

export const sourceConnectionsService = {
  async listConnections(
    db: PostgresJsDatabase,
    queryInput: SourceConnectionListQuery = {},
  ): Promise<SourceConnectionListResult> {
    const query = sourceConnectionListQuerySchema.parse(queryInput)
    const limit = clamp(query.limit ?? 50, 1, 200)
    const offset = Math.max(query.offset ?? 0, 0)
    const conditions = []
    if (query.sourceKind) conditions.push(eq(sourceConnections.sourceKind, query.sourceKind))
    if (query.capabilityScope) {
      conditions.push(eq(sourceConnections.capabilityScope, query.capabilityScope))
    }
    if (query.sourceOfTruthMode) {
      conditions.push(eq(sourceConnections.sourceOfTruthMode, query.sourceOfTruthMode))
    }
    if (query.status) conditions.push(eq(sourceConnections.status, query.status))
    if (query.healthStatus) conditions.push(eq(sourceConnections.healthStatus, query.healthStatus))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countRow] = await Promise.all([
      db
        .select()
        .from(sourceConnections)
        .where(where)
        .orderBy(desc(sourceConnections.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(sourceConnections).where(where),
    ])

    return {
      data: rows,
      total: countRow[0]?.count ?? 0,
      limit,
      offset,
    }
  },

  async getConnectionById(db: PostgresJsDatabase, id: string): Promise<SourceConnection | null> {
    const [row] = await db
      .select()
      .from(sourceConnections)
      .where(eq(sourceConnections.id, id))
      .limit(1)
    return row ?? null
  },

  async createDraftConnection(
    db: PostgresJsDatabase,
    input: CreateSourceConnectionDraftInput,
  ): Promise<SourceConnection> {
    const data = createSourceConnectionDraftSchema.parse(input)
    assertNoSecretLikeJson(data.rateLimitState, "rateLimitState")
    assertNoSecretLikeJson(data.cursorState, "cursorState")
    assertNoSecretLikeJson(data.metadata, "metadata")

    const [row] = await db
      .insert(sourceConnections)
      .values({
        ...data,
        status: "draft",
        healthStatus: "unknown",
        updatedAt: new Date(),
      })
      .returning()
    if (!row) throw new Error("Source connection insert did not return a row")
    return row
  },

  async pauseConnection(
    db: PostgresJsDatabase,
    id: string,
    input: PauseSourceConnectionInput = {},
  ): Promise<SourceConnection | null> {
    const body = pauseSourceConnectionSchema.parse(input)
    const existing = await this.getConnectionById(db, id)
    if (!existing) return null
    assertCanTransition(existing.status, "paused")
    return updateConnection(db, id, {
      status: "paused",
      lastErrorMessage: body.reason ?? existing.lastErrorMessage,
    })
  },

  async resumeConnection(
    db: PostgresJsDatabase,
    id: string,
    input: ResumeSourceConnectionInput = {},
  ): Promise<SourceConnection | null> {
    resumeSourceConnectionSchema.parse(input)
    const existing = await this.getConnectionById(db, id)
    if (!existing) return null
    assertCanTransition(existing.status, "active")
    return updateConnection(db, id, {
      status: "active",
      lastErrorCode: null,
      lastErrorMessage: null,
    })
  },

  async markDisconnected(
    db: PostgresJsDatabase,
    id: string,
    input: DisconnectSourceConnectionInput = { disconnectBehavior: [] },
  ): Promise<SourceConnection | null> {
    const body = disconnectSourceConnectionSchema.parse(input)
    const existing = await this.getConnectionById(db, id)
    if (!existing) return null
    assertCanTransition(existing.status, "disconnected")
    const now = new Date()
    return updateConnection(db, id, {
      status: "disconnected",
      disconnectBehavior: body.disconnectBehavior,
      disconnectReason: body.reason ?? existing.disconnectReason,
      disconnectRequestedAt: existing.disconnectRequestedAt ?? now,
      disconnectedAt: now,
    })
  },
}

async function updateConnection(
  db: PostgresJsDatabase,
  id: string,
  patch: Partial<SourceConnection>,
): Promise<SourceConnection | null> {
  const [row] = await db
    .update(sourceConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sourceConnections.id, id))
    .returning()
  return row ?? null
}

function assertCanTransition(from: SourceConnectionStatus, to: SourceConnectionStatus) {
  const allowed: Record<SourceConnectionStatus, SourceConnectionStatus[]> = {
    draft: ["active", "paused", "disconnected"],
    active: ["paused", "degraded", "disconnecting", "disconnected"],
    paused: ["active", "disconnected"],
    degraded: ["active", "paused", "disconnecting", "disconnected"],
    disconnecting: ["disconnected"],
    disconnected: [],
  }
  if (!allowed[from].includes(to)) {
    throw new SourceConnectionLifecycleError(`Cannot transition source connection to ${to}`, {
      from,
      to,
    })
  }
}

function assertNoSecretLikeJson(value: unknown, path: string) {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoSecretLikeJson(item, `${path}[${index}]`)
    }
    return
  }
  if (typeof value !== "object") return

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeyPattern.test(key)) {
      throw new SourceConnectionLifecycleError(
        "Source connection JSON payloads must not contain raw vendor secrets",
        { path: `${path}.${key}` },
      )
    }
    assertNoSecretLikeJson(nested, `${path}.${key}`)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}
