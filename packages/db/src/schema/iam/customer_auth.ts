/**
 * Better Auth storage for the storefront-customer realm.
 *
 * Customer identities intentionally live in their own Postgres schema. They
 * never share unique constraints, foreign keys, sessions, accounts, or
 * verification tokens with Operator administrators.
 */
import { sql } from "drizzle-orm"
import { boolean, check, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const customerAuthSchema = pgSchema("customer_auth")

export const customerAuthUser = customerAuthSchema.table(
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
    uniqueIndex("customer_auth_user_email_unique")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
    uniqueIndex("customer_auth_user_phone_unique")
      .on(table.phoneNumber)
      .where(sql`${table.phoneNumber} IS NOT NULL`),
    check(
      "customer_auth_user_email_or_phone",
      sql`${table.email} IS NOT NULL OR ${table.phoneNumber} IS NOT NULL`,
    ),
  ],
)

export const customerAuthSession = customerAuthSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => customerAuthUser.id, { onDelete: "cascade" }),
})

export const customerAuthAccount = customerAuthSchema.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => customerAuthUser.id, { onDelete: "cascade" }),
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
  (table) => [
    uniqueIndex("customer_auth_account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
)

export const customerAuthVerification = customerAuthSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
})

export type SelectCustomerAuthUser = typeof customerAuthUser.$inferSelect
export type InsertCustomerAuthUser = typeof customerAuthUser.$inferInsert
export type SelectCustomerAuthSession = typeof customerAuthSession.$inferSelect
export type InsertCustomerAuthSession = typeof customerAuthSession.$inferInsert
