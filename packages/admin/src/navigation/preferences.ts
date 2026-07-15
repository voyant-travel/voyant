import { createContext, createElement, type ReactNode, useContext } from "react"

import type { NavItem, NavSubItem } from "../types.js"

export type AdminNavigationVisibilityMap = Readonly<Record<string, boolean>>

export interface AdminNavigationPreferences {
  organization: AdminNavigationVisibilityMap
  member: AdminNavigationVisibilityMap
}

export interface AdminNavigationPreferencesSnapshot extends AdminNavigationPreferences {
  effective: AdminNavigationVisibilityMap
  canManageOrganization: boolean
}

export interface AdminNavigationPreferencesClient {
  baseUrl: string
  fetcher: (url: string, init?: RequestInit) => Promise<Response>
}

export interface AdminNavigationPreferencesContribution {
  queryKey: (memberKey: string) => ReadonlyArray<unknown>
  load: (client: AdminNavigationPreferencesClient) => Promise<AdminNavigationPreferencesSnapshot>
}

const AdminNavigationPreferencesMemberContext = createContext<string | null>(null)

export function AdminNavigationPreferencesMemberProvider({
  memberKey,
  children,
}: {
  memberKey: string
  children: ReactNode
}) {
  return createElement(
    AdminNavigationPreferencesMemberContext.Provider,
    { value: memberKey },
    children,
  )
}

export function useAdminNavigationPreferencesMemberKey(): string {
  const memberKey = useContext(AdminNavigationPreferencesMemberContext)
  if (memberKey === null) {
    throw new Error(
      "useAdminNavigationPreferencesMemberKey must be used inside AdminWorkspaceShell",
    )
  }
  return memberKey
}

export interface ResolveAdminNavigationPreferencesOptions extends AdminNavigationPreferences {
  items: ReadonlyArray<NavItem>
}

/**
 * Apply visibility only to the already-merged, already-eligible navigation.
 * Preferences can therefore remove known items, but can never manufacture an
 * item that graph selection or capability checks excluded.
 */
export function resolveAdminNavigationPreferences({
  items,
  organization,
  member,
}: ResolveAdminNavigationPreferencesOptions): NavItem[] {
  return items.flatMap((item) => resolveItem(item, organization, member))
}

function resolveItem(
  item: NavItem,
  organization: AdminNavigationVisibilityMap,
  member: AdminNavigationVisibilityMap,
): NavItem[] {
  const visible = resolveVisibility(item.id, organization, member, true)
  const children = item.items?.flatMap((child) =>
    resolveVisibility(child.id, organization, member, visible) ? [child] : [],
  )

  if (!visible && !children?.length) return []

  return [
    {
      ...item,
      ...(item.items ? { items: children } : {}),
      ...(!visible ? { structural: true } : {}),
    },
  ]
}

function resolveVisibility(
  id: NavItem["id"] | NavSubItem["id"],
  organization: AdminNavigationVisibilityMap,
  member: AdminNavigationVisibilityMap,
  inherited: boolean,
): boolean {
  if (Object.hasOwn(member, id)) return member[id] !== false
  if (Object.hasOwn(organization, id)) return organization[id] !== false
  return inherited
}
