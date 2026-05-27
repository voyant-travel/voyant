import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { typeId } from "../../lib/index.js"

/**
 * Token grants for unauthenticated, customer-safe document delivery.
 *
 * Only the SHA-256 hash of the opaque token is stored. Each row grants access
 * to exactly one object-storage key until it expires or is revoked.
 */
export const infraPublicDocumentDeliveryGrantsTable = pgTable(
  "public_document_delivery_grants",
  {
    id: typeId("public_document_delivery_grants"),
    tokenHash: text("token_hash").notNull(),
    storageKey: text("storage_key").notNull(),
    storageProvider: text("storage_provider"),
    filename: text("filename"),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    sourceModule: text("source_module"),
    sourceEntity: text("source_entity"),
    sourceId: text("source_id"),
    createdBy: text("created_by"),
    createdByType: text("created_by_type"),
    metadata: jsonb("metadata"),
    accessCount: integer("access_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    lastAccessedIp: text("last_accessed_ip"),
    lastAccessedUserAgent: text("last_accessed_user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("uidx_public_document_delivery_grants_token_hash").on(table.tokenHash),
    index("idx_public_document_delivery_grants_expires_at").on(table.expiresAt),
    index("idx_public_document_delivery_grants_source").on(
      table.sourceModule,
      table.sourceEntity,
      table.sourceId,
    ),
    index("idx_public_document_delivery_grants_revoked_at").on(table.revokedAt),
  ],
).enableRLS()

export type InsertInfraPublicDocumentDeliveryGrant =
  typeof infraPublicDocumentDeliveryGrantsTable.$inferInsert
export type SelectInfraPublicDocumentDeliveryGrant =
  typeof infraPublicDocumentDeliveryGrantsTable.$inferSelect
