import { boolean, index, jsonb, text, timestamp } from "drizzle-orm/pg-core"

import { customerAuthSchema, customerAuthUser } from "./customer_auth.js"
import { seatingPreferences } from "./user_profiles.js"

/** Storefront preferences keyed only to the customer auth realm. */
export const customerAuthProfilesTable = customerAuthSchema
  .table(
    "profile",
    {
      id: text("id")
        .primaryKey()
        .references(() => customerAuthUser.id, { onDelete: "cascade" }),
      firstName: text("first_name"),
      lastName: text("last_name"),
      avatarUrl: text("avatar_url"),
      locale: text("locale").notNull().default("en"),
      timezone: text("timezone"),
      uiPrefs: jsonb("ui_prefs").$type<Record<string, unknown>>().default({}),
      seatingPreference: seatingPreferences("seating_preference"),
      notificationDefaults: jsonb("notification_defaults")
        .$type<Record<string, unknown>>()
        .default({}),
      marketingConsent: boolean("marketing_consent").notNull().default(false),
      marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
      marketingConsentSource: text("marketing_consent_source"),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("customer_auth_profile_name_idx").on(table.firstName, table.lastName)],
  )
  .enableRLS()

export type SelectCustomerAuthProfile = typeof customerAuthProfilesTable.$inferSelect
export type InsertCustomerAuthProfile = typeof customerAuthProfilesTable.$inferInsert
