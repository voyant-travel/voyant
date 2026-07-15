import type * as React from "react"

/**
 * Minimal user shape the admin shell needs to render its user menu.
 * Starters can pass their own richer user object — only these fields matter.
 */
export interface AdminUser {
  id?: string
  email: string
  firstName?: string | null
  lastName?: string | null
  locale?: string | null
  timeZone?: string | null
  /** Legacy combined name field. `firstName`/`lastName` take precedence. */
  name?: string
  avatar?: string | null
}

export const COMING_SOON = "COMING_SOON" as const
export const BETA = "BETA" as const
export type NavItemStatus = typeof COMING_SOON | typeof BETA

/**
 * Nav tree item. Icons are passed as React components (from `lucide-react`
 * or elsewhere) so starters control the icon set.
 */
export interface NavItem {
  /** Stable identifier for extension merging and persisted preferences. */
  id: string
  title: string
  url: string
  icon?: React.ComponentType<{ className?: string }>
  status?: NavItemStatus
  /** Link target attribute for external URLs. Defaults to "_self". */
  target?: "_self" | "_blank"
  /** Collapsible sub-items. */
  items?: ReadonlyArray<NavSubItem>
  /** Retained only as a non-navigable container for visible descendants. */
  structural?: boolean
}

export interface NavSubItem {
  /** Stable identifier for persisted preferences. */
  id: string
  title: string
  url: string
  icon?: React.ComponentType<{ className?: string }>
  status?: NavItemStatus
  target?: "_self" | "_blank"
}

/**
 * Actions the admin shell delegates back to the starter's auth layer.
 * Starters wire these up to their chosen auth stack (Better Auth, etc).
 */
export interface AuthActions {
  /** Fired when the user clicks "Log out" in the user menu. */
  signOut: () => void | Promise<void>
}

/**
 * Theme mode. "system" follows `prefers-color-scheme`.
 */
export type ThemeMode = "light" | "dark" | "system"
