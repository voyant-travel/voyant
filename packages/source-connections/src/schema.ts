import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const sourceConnectionTruthModeEnum = pgEnum("source_connection_truth_mode", [
  "native",
  "mirrored",
  "external-live",
  "hybrid",
])

export const sourceConnectionStatusEnum = pgEnum("source_connection_status", [
  "draft",
  "active",
  "paused",
  "degraded",
  "disconnecting",
  "disconnected",
])

export const sourceConnectionHealthStatusEnum = pgEnum("source_connection_health_status", [
  "unknown",
  "healthy",
  "degraded",
  "failing",
])

export type SourceConnectionTruthMode = (typeof sourceConnectionTruthModeEnum.enumValues)[number]
export type SourceConnectionStatus = (typeof sourceConnectionStatusEnum.enumValues)[number]
export type SourceConnectionHealthStatus =
  (typeof sourceConnectionHealthStatusEnum.enumValues)[number]

export interface SourceConnectionCapabilityDeclaration {
  capability: string
  state: "supported" | "unsupported" | "unknown"
  notes?: string
}

export type SourceConnectionRateLimitState = Record<string, unknown>
export type SourceConnectionCursorState = Record<string, unknown>
export type SourceConnectionMetadata = Record<string, unknown>

export const sourceConnections = pgTable(
  "source_connections",
  {
    id: typeId("source_connections"),
    sourceKind: text("source_kind").notNull(),
    displayName: text("display_name").notNull(),
    capabilityScope: text("capability_scope").notNull(),
    sourceOfTruthMode: sourceConnectionTruthModeEnum("source_of_truth_mode").notNull(),
    status: sourceConnectionStatusEnum("status").notNull().default("draft"),

    credentialRef: text("credential_ref"),
    credentialRefVersion: text("credential_ref_version"),
    sourceAccountId: text("source_account_id"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    capabilities: jsonb("capabilities")
      .$type<SourceConnectionCapabilityDeclaration[]>()
      .notNull()
      .default([]),

    healthStatus: sourceConnectionHealthStatusEnum("health_status").notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastHealthyAt: timestamp("last_healthy_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    retryAfterAt: timestamp("retry_after_at", { withTimezone: true }),
    rateLimitState: jsonb("rate_limit_state").$type<SourceConnectionRateLimitState | null>(),
    cursorState: jsonb("cursor_state").$type<SourceConnectionCursorState | null>(),

    disconnectBehavior: jsonb("disconnect_behavior").$type<string[]>().notNull().default([]),
    disconnectReason: text("disconnect_reason"),
    disconnectRequestedAt: timestamp("disconnect_requested_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),

    metadata: jsonb("metadata").$type<SourceConnectionMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_source_connections_source_kind").on(table.sourceKind),
    index("idx_source_connections_scope_status").on(table.capabilityScope, table.status),
    index("idx_source_connections_truth_mode").on(table.sourceOfTruthMode),
    index("idx_source_connections_health").on(table.healthStatus, table.lastCheckedAt),
    // GIN indexes keep scope/capability filtering cheap without committing to a vendor schema.
    // agent-quality: raw-sql reviewed -- owner: source-connections; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    index("idx_source_connections_granted_scopes_gin").using("gin", sql`${table.grantedScopes}`),
    // agent-quality: raw-sql reviewed -- owner: source-connections; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    index("idx_source_connections_capabilities_gin").using("gin", sql`${table.capabilities}`),
  ],
)

export type SourceConnection = typeof sourceConnections.$inferSelect
export type NewSourceConnection = typeof sourceConnections.$inferInsert
