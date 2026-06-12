/**
 * Better Auth table definitions (public schema).
 *
 * These tables are managed by Better Auth for authentication state.
 * Defining them in Drizzle ensures they are created by `pnpm db:migrate`
 * and can be queried with typed Drizzle queries (e.g. edge middleware).
 *
 * Column names use snake_case in SQL but Better Auth accesses them via
 * camelCase JS property names — the Drizzle adapter handles the mapping.
 */

import { sql } from "drizzle-orm"
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// user
//
// Either `email` or `phoneNumber` must be set — phone-only signups (Better
// Auth phone-OTP plugin) skip email entirely. Both columns are individually
// unique among non-null rows via partial unique indexes; the check
// constraint guards against rows with neither identifier.
// ---------------------------------------------------------------------------
export const authUser = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    emailVerified: boolean("email_verified").notNull(),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    uniqueIndex("user_email_unique").on(table.email).where(sql`${table.email} IS NOT NULL`),
    uniqueIndex("user_phone_unique")
      .on(table.phoneNumber)
      // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.phoneNumber} IS NOT NULL`),
    check(
      "user_email_or_phone",
      // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      sql`${table.email} IS NOT NULL OR ${table.phoneNumber} IS NOT NULL`,
    ),
  ],
)

export type SelectAuthUser = typeof authUser.$inferSelect
export type InsertAuthUser = typeof authUser.$inferInsert

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------
export const authSession = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
})

export type SelectAuthSession = typeof authSession.$inferSelect
export type InsertAuthSession = typeof authSession.$inferInsert

// ---------------------------------------------------------------------------
// account
// ---------------------------------------------------------------------------
export const authAccount = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)],
)

export type SelectAuthAccount = typeof authAccount.$inferSelect
export type InsertAuthAccount = typeof authAccount.$inferInsert

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------
export const authVerification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
})

export type SelectAuthVerification = typeof authVerification.$inferSelect
export type InsertAuthVerification = typeof authVerification.$inferInsert

// ---------------------------------------------------------------------------
// organization (Better Auth organization plugin)
// ---------------------------------------------------------------------------
export const authOrganization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
})

export type SelectAuthOrganization = typeof authOrganization.$inferSelect
export type InsertAuthOrganization = typeof authOrganization.$inferInsert

// ---------------------------------------------------------------------------
// member (Better Auth organization plugin)
// ---------------------------------------------------------------------------
export const authMember = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_member_user_id").on(table.userId),
    index("idx_member_organization_id").on(table.organizationId),
    index("idx_member_user_organization").on(table.userId, table.organizationId),
  ],
)

export type SelectAuthMember = typeof authMember.$inferSelect
export type InsertAuthMember = typeof authMember.$inferInsert

// ---------------------------------------------------------------------------
// invitation (Better Auth organization plugin)
// ---------------------------------------------------------------------------
export const authInvitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_invitation_email").on(table.email),
    index("idx_invitation_organization_id").on(table.organizationId),
  ],
)

export type SelectAuthInvitation = typeof authInvitation.$inferSelect
export type InsertAuthInvitation = typeof authInvitation.$inferInsert
