import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { typeId } from "../../lib/typeid-column.js"

/**
 * Admin-issued user invitations.
 *
 * Single-tenant sign-up is disabled at the Better Auth layer; new staff users
 * only enter the system by redeeming an invitation issued by an existing
 * admin. The raw token lives only in the invite email/link; we store its
 * SHA-256 hash so a DB leak can't grant access.
 */
export const userInvitationsTable = pgTable(
  "user_invitations",
  {
    id: typeId("user_invitations"),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedByUserId: text("redeemed_by_user_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uidx_user_invitations_token_hash").on(t.tokenHash),
    index("idx_user_invitations_email").on(t.email),
    index("idx_user_invitations_redeemed_at").on(t.redeemedAt),
    index("idx_user_invitations_expires_at").on(t.expiresAt),
  ],
)

export type SelectUserInvitation = typeof userInvitationsTable.$inferSelect
export type InsertUserInvitation = typeof userInvitationsTable.$inferInsert
