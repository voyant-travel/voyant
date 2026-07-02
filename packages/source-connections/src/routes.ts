import { handleApiError, parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"

import type { SourceConnection } from "./schema.js"
import {
  SourceConnectionLifecycleError,
  type SourceConnectionListResult,
  sourceConnectionsService,
} from "./service.js"
import {
  createSourceConnectionDraftSchema,
  disconnectSourceConnectionSchema,
  pauseSourceConnectionSchema,
  sourceConnectionListQuerySchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

type SourceConnectionResponse = Omit<
  SourceConnection,
  | "createdAt"
  | "updatedAt"
  | "lastCheckedAt"
  | "lastHealthyAt"
  | "retryAfterAt"
  | "disconnectRequestedAt"
  | "disconnectedAt"
> & {
  createdAt: string
  updatedAt: string
  lastCheckedAt: string | null
  lastHealthyAt: string | null
  retryAfterAt: string | null
  disconnectRequestedAt: string | null
  disconnectedAt: string | null
}

export interface SourceConnectionListResponse extends Omit<SourceConnectionListResult, "data"> {
  data: SourceConnectionResponse[]
}

export interface SourceConnectionDetailResponse {
  data: SourceConnectionResponse
}

export interface SourceConnectionHealthResponse {
  data: {
    status: "unknown" | "healthy" | "degraded" | "failing"
    checkedAt: string
    connections: SourceConnectionResponse[]
  }
}

function serializeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Source connection timestamp must be a valid date")
  }
  return date.toISOString()
}

function serializeNullableDate(value: Date | string | null): string | null {
  if (value === null) return null
  return serializeDate(value)
}

export function serializeSourceConnection(row: SourceConnection): SourceConnectionResponse {
  return {
    ...row,
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
    lastCheckedAt: serializeNullableDate(row.lastCheckedAt),
    lastHealthyAt: serializeNullableDate(row.lastHealthyAt),
    retryAfterAt: serializeNullableDate(row.retryAfterAt),
    disconnectRequestedAt: serializeNullableDate(row.disconnectRequestedAt),
    disconnectedAt: serializeNullableDate(row.disconnectedAt),
  }
}

async function listSourceConnections(c: Context<Env>) {
  const query = parseQuery(c, sourceConnectionListQuerySchema)
  const result = await sourceConnectionsService.listConnections(c.get("db"), query)
  return c.json({
    ...result,
    data: result.data.map(serializeSourceConnection),
  } satisfies SourceConnectionListResponse)
}

async function getSourceConnection(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "Source connection not found" }, 404)
  const row = await sourceConnectionsService.getConnectionById(c.get("db"), id)
  if (!row) return c.json({ error: "Source connection not found" }, 404)
  return c.json({ data: serializeSourceConnection(row) } satisfies SourceConnectionDetailResponse)
}

async function createSourceConnectionDraft(c: Context<Env>) {
  try {
    const body = await parseJsonBody(c, createSourceConnectionDraftSchema)
    const row = await sourceConnectionsService.createDraftConnection(c.get("db"), body)
    return c.json(
      { data: serializeSourceConnection(row) } satisfies SourceConnectionDetailResponse,
      201,
    )
  } catch (error) {
    if (error instanceof SourceConnectionLifecycleError) {
      return c.json(
        { error: error.message, code: error.code, details: error.details },
        error.status,
      )
    }
    throw error
  }
}

async function pauseSourceConnection(c: Context<Env>) {
  try {
    const id = c.req.param("id")
    if (!id) return c.json({ error: "Source connection not found" }, 404)
    const row = await sourceConnectionsService.pauseConnection(
      c.get("db"),
      id,
      await parseJsonBody(c, pauseSourceConnectionSchema),
    )
    if (!row) return c.json({ error: "Source connection not found" }, 404)
    return c.json({ data: serializeSourceConnection(row) } satisfies SourceConnectionDetailResponse)
  } catch (error) {
    if (error instanceof SourceConnectionLifecycleError) {
      return c.json(
        { error: error.message, code: error.code, details: error.details },
        error.status,
      )
    }
    throw error
  }
}

async function resumeSourceConnection(c: Context<Env>) {
  try {
    const id = c.req.param("id")
    if (!id) return c.json({ error: "Source connection not found" }, 404)
    const row = await sourceConnectionsService.resumeConnection(c.get("db"), id, {})
    if (!row) return c.json({ error: "Source connection not found" }, 404)
    return c.json({ data: serializeSourceConnection(row) } satisfies SourceConnectionDetailResponse)
  } catch (error) {
    if (error instanceof SourceConnectionLifecycleError) {
      return c.json(
        { error: error.message, code: error.code, details: error.details },
        error.status,
      )
    }
    throw error
  }
}

async function disconnectSourceConnection(c: Context<Env>) {
  try {
    const id = c.req.param("id")
    if (!id) return c.json({ error: "Source connection not found" }, 404)
    const row = await sourceConnectionsService.markDisconnected(
      c.get("db"),
      id,
      await parseJsonBody(c, disconnectSourceConnectionSchema),
    )
    if (!row) return c.json({ error: "Source connection not found" }, 404)
    return c.json({ data: serializeSourceConnection(row) } satisfies SourceConnectionDetailResponse)
  } catch (error) {
    if (error instanceof SourceConnectionLifecycleError) {
      return c.json(
        { error: error.message, code: error.code, details: error.details },
        error.status,
      )
    }
    throw error
  }
}

async function getSourceConnectionHealth(c: Context<Env>) {
  const result = await sourceConnectionsService.listConnections(c.get("db"), { limit: 200 })
  const rows = result.data.map(serializeSourceConnection)
  return c.json({
    data: {
      status: summarizeHealth(rows.map((row) => row.healthStatus)),
      checkedAt: new Date().toISOString(),
      connections: rows,
    },
  } satisfies SourceConnectionHealthResponse)
}

function summarizeHealth(
  statuses: SourceConnectionResponse["healthStatus"][],
): SourceConnectionHealthResponse["data"]["status"] {
  if (statuses.length === 0) return "unknown"
  if (statuses.some((status) => status === "failing")) return "failing"
  if (statuses.some((status) => status === "degraded")) return "degraded"
  if (statuses.every((status) => status === "healthy")) return "healthy"
  return "unknown"
}

export const sourceConnectionsAdminRoutes = new Hono<Env>()
  .get("/", listSourceConnections)
  .post("/", createSourceConnectionDraft)
  .get("/health", getSourceConnectionHealth)
  .get("/:id", getSourceConnection)
  .post("/:id/pause", pauseSourceConnection)
  .post("/:id/resume", resumeSourceConnection)
  .post("/:id/disconnect", disconnectSourceConnection)

sourceConnectionsAdminRoutes.onError((error, c) => handleApiError(error, c))

export type SourceConnectionsAdminRoutes = typeof sourceConnectionsAdminRoutes
