import type { QueryClient } from "@tanstack/react-query"
import type * as React from "react"

import type { NavItem } from "./types.js"

/**
 * App-supplied runtime handed to route loaders: where the API lives and how
 * to reach it (the host's cookie-forwarding fetcher in SSR setups).
 */
export interface AdminRouteRuntime {
  baseUrl: string
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export interface AdminRouteLoaderContext {
  queryClient: QueryClient
  runtime: AdminRouteRuntime
}

/**
 * A named route contribution for the admin shell.
 *
 * Originally metadata only; as of the packaged-admin RFC Phase 2
 * (docs/architecture/packaged-admin-rfc.md §4.2) contributions may carry the
 * route IMPLEMENTATION — everything a template route file can express — so
 * domain packages can ship pages. All implementation fields are optional:
 * metadata-only contributions remain valid, and hosts decide how the fields
 * map onto their router (TanStack hosts spread them into route options).
 */
export interface AdminUiRouteContribution {
  id: string
  path: string
  title: string
  /** The page. Keep it lazy-importable for code-splitting. */
  component?: React.ComponentType
  /** Data loader; receives the host QueryClient + app runtime. */
  loader?: (ctx: AdminRouteLoaderContext) => unknown
  /** Typed search-param validation (e.g. a zod schema's parse). */
  validateSearch?: (search: Record<string, unknown>) => unknown
  /** Per-route SSR mode, mirroring the host router's option. */
  ssr?: boolean | "data-only"
  pendingComponent?: React.ComponentType
  errorComponent?: React.ComponentType<{ error: unknown; reset: () => void }>
  /** Capability/permission key the shell checks before rendering. */
  capability?: string
  /** Preload policy override, mirroring the host router's option. */
  preload?: false | "intent" | "render" | "viewport"
}

/**
 * Contribute one or more navigation items to the shared admin shell.
 *
 * Contributions are appended after the template's base navigation and sorted
 * by `order`. Set `insertAfter` to a base nav item id to splice the
 * contribution's items in directly after that item instead — useful when
 * the extension's items belong logically next to a built-in entry (e.g.
 * Trips below Bookings).
 */
export interface AdminNavigationContribution {
  items: ReadonlyArray<NavItem>
  order?: number
  insertAfter?: string
}

/**
 * Named widget slot identifier.
 *
 * Templates define the slots they expose on specific admin pages and modules
 * or extensions can target them with React components.
 */
export type AdminWidgetSlot = string

/**
 * A widget contribution that can be rendered inside a template-defined slot.
 */
export interface AdminWidgetContribution<Props = Record<string, unknown>> {
  id: string
  slot: AdminWidgetSlot
  order?: number
  component: React.ComponentType<Props>
}

/**
 * Shared admin extension bundle.
 *
 * This keeps the extension surface explicit and typed without forcing a more
 * dynamic plugin runtime into templates.
 */
export interface AdminExtension {
  id: string
  navigation?: ReadonlyArray<AdminNavigationContribution>
  routes?: ReadonlyArray<AdminUiRouteContribution>
  widgets?: ReadonlyArray<AdminWidgetContribution>
}

export function defineAdminExtension<T extends AdminExtension>(extension: T): T {
  return extension
}

/**
 * Compose an explicit admin extension registry for a template or app shell.
 *
 * The admin surface stays source-controlled and typed while still routing
 * all contributions through the shared admin runtime package.
 */
export function createAdminExtensionRegistry(
  ...extensions: ReadonlyArray<AdminExtension>
): ReadonlyArray<AdminExtension> {
  return extensions
}

type OrderedValue<T> = {
  index: number
  order: number
  value: T
}

function sortOrderedValues<T>(values: ReadonlyArray<OrderedValue<T>>): T[] {
  return [...values]
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }

      return a.index - b.index
    })
    .map((entry) => entry.value)
}

export interface ResolveAdminNavigationOptions {
  baseItems: ReadonlyArray<NavItem>
  extensions?: ReadonlyArray<AdminExtension>
}

export function resolveAdminNavigation({
  baseItems,
  extensions = [],
}: ResolveAdminNavigationOptions): NavItem[] {
  const contributions = extensions.flatMap((extension) => extension.navigation ?? [])
  const orderedContributions = sortOrderedValues(
    contributions.map((contribution, index) => ({
      index,
      order: contribution.order ?? 0,
      value: contribution,
    })),
  )

  const anchoredByBaseId = new Map<string, NavItem[]>()
  const appended: NavItem[] = []
  for (const contribution of orderedContributions) {
    if (contribution.insertAfter) {
      const bucket = anchoredByBaseId.get(contribution.insertAfter) ?? []
      bucket.push(...contribution.items)
      anchoredByBaseId.set(contribution.insertAfter, bucket)
    } else {
      appended.push(...contribution.items)
    }
  }

  const merged: NavItem[] = []
  for (const item of baseItems) {
    merged.push(item)
    if (!item.id) continue
    const anchored = anchoredByBaseId.get(item.id)
    if (anchored) merged.push(...anchored)
  }
  // Items anchored to a base id that no longer exists fall through to the
  // tail so they're still discoverable rather than silently dropped.
  for (const [baseId, items] of anchoredByBaseId.entries()) {
    if (!baseItems.some((item) => item.id === baseId)) appended.push(...items)
  }
  return [...merged, ...appended]
}

export interface ResolveAdminWidgetsOptions {
  slot: AdminWidgetSlot
  extensions?: ReadonlyArray<AdminExtension>
}

export function resolveAdminWidgets({
  slot,
  extensions = [],
}: ResolveAdminWidgetsOptions): AdminWidgetContribution[] {
  const widgets = extensions
    .flatMap((extension) => extension.widgets ?? [])
    .filter((widget) => widget.slot === slot)

  return sortOrderedValues(
    widgets.map((widget, index) => ({
      index,
      order: widget.order ?? 0,
      value: widget,
    })),
  )
}
