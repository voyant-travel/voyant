import type { VoyantDb } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"

import type { NavigationVisibilityMap, ResolvedNavigationPreferences } from "./contracts.js"
import {
  memberNavigationPreferences,
  ORGANIZATION_NAVIGATION_PREFERENCES_ID,
  organizationNavigationPreferences,
} from "./schema.js"

export function resolveEffectiveNavigationVisibility(
  organization: NavigationVisibilityMap,
  member: NavigationVisibilityMap,
): NavigationVisibilityMap {
  return { ...organization, ...member }
}

export async function getOrganizationNavigationPreferences(
  db: VoyantDb,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .select({ visibility: organizationNavigationPreferences.visibility })
    .from(organizationNavigationPreferences)
    .where(eq(organizationNavigationPreferences.id, ORGANIZATION_NAVIGATION_PREFERENCES_ID))
    .limit(1)
  return row?.visibility ?? {}
}

export async function setOrganizationNavigationPreferences(
  db: VoyantDb,
  visibility: NavigationVisibilityMap,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .insert(organizationNavigationPreferences)
    .values({ id: ORGANIZATION_NAVIGATION_PREFERENCES_ID, visibility })
    .onConflictDoUpdate({
      target: organizationNavigationPreferences.id,
      set: { visibility, updatedAt: new Date() },
    })
    .returning()
  return row?.visibility ?? visibility
}

export async function getMemberNavigationPreferences(
  db: VoyantDb,
  memberId: string,
): Promise<NavigationVisibilityMap> {
  const [row] = await db
    .select({ visibility: memberNavigationPreferences.visibility })
    .from(memberNavigationPreferences)
    .where(eq(memberNavigationPreferences.memberId, memberId))
    .limit(1)
  return row?.visibility ?? {}
}

export async function setMemberNavigationPreferences(
  db: VoyantDb,
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
    .returning()
  return row?.visibility ?? visibility
}

export async function getNavigationPreferences(
  db: VoyantDb,
  memberId: string,
): Promise<ResolvedNavigationPreferences> {
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
