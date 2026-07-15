import { sql } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import type { NavigationVisibilityMap } from "./contracts.js"

export const ORGANIZATION_NAVIGATION_PREFERENCES_ID = "organization"

export const organizationNavigationPreferences = pgTable("organization_navigation_preferences", {
  id: text("id").primaryKey(),
  visibility: jsonb("visibility")
    .$type<NavigationVisibilityMap>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** `memberId` is an auth-owned user ID kept deliberately free of a cross-package FK. */
export const memberNavigationPreferences = pgTable("member_navigation_preferences", {
  memberId: text("member_id").primaryKey(),
  visibility: jsonb("visibility")
    .$type<NavigationVisibilityMap>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OrganizationNavigationPreferences =
  typeof organizationNavigationPreferences.$inferSelect
export type MemberNavigationPreferences = typeof memberNavigationPreferences.$inferSelect
