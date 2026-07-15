import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NavigationVisibilityMap } from "./contracts.js"
import {
  memberNavigationPreferences,
  ORGANIZATION_NAVIGATION_PREFERENCES_ID,
  organizationNavigationPreferences,
} from "./schema.js"

const EMPTY_VISIBILITY: NavigationVisibilityMap = {}

export function resolveEffectiveNavigationVisibility(
  organization: NavigationVisibilityMap,
  member: NavigationVisibilityMap,
): NavigationVisibilityMap {
  return { ...organization, ...member }
}

export async function getOrganizationNavigationPreferences(
  db: PostgresJsDatabase,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .select({ visibility: organizationNavigationPreferences.visibility })
    .from(organizationNavigationPreferences)
    .where(eq(organizationNavigationPreferences.id, ORGANIZATION_NAVIGATION_PREFERENCES_ID))
    .limit(1)
  return row?.visibility ?? EMPTY_VISIBILITY
}

export async function setOrganizationNavigationPreferences(
  db: PostgresJsDatabase,
  visibility: NavigationVisibilityMap,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .insert(organizationNavigationPreferences)
    .values({ id: ORGANIZATION_NAVIGATION_PREFERENCES_ID, visibility })
    .onConflictDoUpdate({
      target: organizationNavigationPreferences.id,
      set: { visibility, updatedAt: new Date() },
    })
    .returning({ visibility: organizationNavigationPreferences.visibility })
  return row?.visibility ?? visibility
}

export async function getMemberNavigationPreferences(
  db: PostgresJsDatabase,
  memberId: string,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .select({ visibility: memberNavigationPreferences.visibility })
    .from(memberNavigationPreferences)
    .where(eq(memberNavigationPreferences.memberId, memberId))
    .limit(1)
  return row?.visibility ?? EMPTY_VISIBILITY
}

export async function setMemberNavigationPreferences(
  db: PostgresJsDatabase,
  memberId: string,
  visibility: NavigationVisibilityMap,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .insert(memberNavigationPreferences)
    .values({ memberId, visibility })
    .onConflictDoUpdate({
      target: memberNavigationPreferences.memberId,
      set: { visibility, updatedAt: new Date() },
    })
    .returning({ visibility: memberNavigationPreferences.visibility })
  return row?.visibility ?? visibility
}

export async function getNavigationPreferences(
  db: PostgresJsDatabase,
  memberId: string,
): Promise<{
  organization: NavigationVisibilityMap
  member: NavigationVisibilityMap
  effective: NavigationVisibilityMap
}> {
  const [organization, member] = await Promise.all([
    getOrganizationNavigationPreferences(db),
    getMemberNavigationPreferences(db, memberId),
  ])
  return {
    organization,
    member,
    effective: resolveEffectiveNavigationVisibility(organization, member),
  }
}
