import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { authSession, authUser } from "./auth.js"

export const cloudAuthUserLinks = pgTable(
  "cloud_auth_user_links",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => authUser.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull().default("voyant-cloud"),
    providerAccountId: text("provider_account_id").notNull(),
    deploymentId: text("deployment_id").notNull(),
    platformOrganizationId: text("platform_organization_id").notNull(),
    workosOrganizationId: text("workos_organization_id").notNull(),
    membershipId: text("membership_id"),
    roleSlug: text("role_slug"),
    roleName: text("role_name"),
    surfaces: jsonb("surfaces").$type<string[]>().default([]),
    /**
     * Member RBAC scope set mirrored from the login assertion — `resource:action`
     * permission strings (same vocabulary as API keys). `null` means the
     * assertion carried no scopes (older platform): resolveAuthRequest then falls
     * back to the role bundle or full access. See docs/architecture/member-rbac-rfc.md.
     */
    scopes: jsonb("scopes").$type<string[]>(),
    lastAssertionAt: timestamp("last_assertion_at", { withTimezone: true }),
    lastRevalidatedAt: timestamp("last_revalidated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cloud_auth_user_provider_account_unique").on(
      table.providerId,
      table.providerAccountId,
    ),
    index("idx_cloud_auth_user_deployment").on(table.deploymentId),
    index("idx_cloud_auth_user_revalidation").on(table.revokedAt, table.lastRevalidatedAt),
  ],
)

export type SelectCloudAuthUserLink = typeof cloudAuthUserLinks.$inferSelect
export type InsertCloudAuthUserLink = typeof cloudAuthUserLinks.$inferInsert

export const cloudAuthSessionLinks = pgTable(
  "cloud_auth_session_links",
  {
    sessionId: text("session_id")
      .primaryKey()
      .references(() => authSession.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull().default("voyant-cloud"),
    providerAccountId: text("provider_account_id").notNull(),
    deploymentId: text("deployment_id").notNull(),
    revalidateAfter: timestamp("revalidate_after", { withTimezone: true }).notNull(),
    lastRevalidatedAt: timestamp("last_revalidated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cloud_auth_session_user").on(table.userId),
    index("idx_cloud_auth_session_revalidate_after").on(table.revalidateAfter),
    index("idx_cloud_auth_session_revoked_at").on(table.revokedAt),
  ],
)

export type SelectCloudAuthSessionLink = typeof cloudAuthSessionLinks.$inferSelect
export type InsertCloudAuthSessionLink = typeof cloudAuthSessionLinks.$inferInsert
