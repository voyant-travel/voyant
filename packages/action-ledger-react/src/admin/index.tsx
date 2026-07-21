import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
  type NavItem,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin"
// Lean static only: the shared fetcher fallback. The page-data helpers
// resolve via dynamic import inside the loader so the admin REST module
// stays out of the workspace-chrome chunk that evaluates this factory.
import { defaultFetcher } from "@voyant-travel/react"
import { ScrollText } from "lucide-react"

/**
 * No destinations declared: nothing navigates TO the Logs page by semantic
 * key (the nav entry below carries the URL), and the page's own outbound
 * link (`booking.detail`) comes from the bookings-react augmentation bound
 * in the host module.
 */

// Packaged admin hosts (packaged-admin RFC Phase 3): the Logs page bound to
// its data wiring (the shared provider context) + semantic-destination
// navigation.
//
// Endgame rule (packaged-admin RFC §4.8): this barrel re-exports NO page
// or host component values — it is evaluated with the workspace chrome, so
// a static host re-export would pin the page modules (table, sheet, the
// bookings/crm/products picker comboboxes) into the entry chunk. Hosts
// import from their specific modules; only their TYPES re-export here.
export type { ActionLedgerAdminClient } from "./admin-api.js"
export { actionLedgerQueryKeys } from "./query-keys.js"

export interface CreateActionLedgerAdminExtensionOptions {
  /** Mount path of the Logs page inside the admin workspace. Default `/action-ledger`. */
  path?: string
  /** Localized nav/page labels. Defaults are the English operator nav labels. */
  labels?: {
    actionLedger?: string
  }
  /** Nav icon — icon choice stays with the host (e.g. lucide `ScrollText`). */
  icon?: NavItem["icon"]
  /** Nav ordering past the host's base items. Default 60. */
  order?: number
}

/**
 * The action-ledger admin contribution (packaged-admin RFC Phase 3,
 * `@voyant-travel/<domain>-react/admin` convention).
 *
 * NAVIGATION: package-delivered. The Logs item is NOT part of the BASE
 * operator navigation (`createOperatorAdminNavigation` in
 * `@voyant-travel/admin`), so the extension contributes it — order 60 nudges it
 * past the default admin items so it lands with the operator's audit
 * tooling. The icon stays a host choice.
 *
 * ROUTES: the contribution carries the FULL route implementation
 * (packaged-admin RFC §4.2/§4.8) — a lazy `page` module loader resolving
 * the packaged `ActionLedgerHost`, plus a loader that seeds the first
 * (unfiltered, newest-first) Logs page through the host-supplied runtime.
 * Filters and cursor paging stay component-local, so there is no URL
 * search contract.
 *
 * WIDGETS: none contributed and no slots exposed yet.
 */
export function createActionLedgerAdminExtension(
  options: CreateActionLedgerAdminExtensionOptions = {},
): AdminExtension {
  const { path = "/action-ledger", labels = {}, icon, order = 60 } = options
  const { actionLedger = "Logs" } = labels

  return defineAdminExtension({
    id: "action-ledger",
    navigation: [
      {
        order,
        items: [{ id: "action-ledger", title: actionLedger, url: path, icon }],
      },
    ],
    routes: [
      {
        id: "action-ledger-index",
        path,
        title: actionLedger,
        ssr: "data-only",
        page: () =>
          import("./action-ledger-host.js").then((module) =>
            adminRoutePageModule(module.ActionLedgerHost),
          ),
        // Dynamic import on purpose: the helper pulls the admin REST
        // module, and a static import here would pin it into the
        // workspace-chrome chunk that evaluates this factory.
        loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
          const { actionLedgerFirstPageQueryOptions } = await import("./admin-api.js")
          return queryClient.ensureQueryData(
            actionLedgerFirstPageQueryOptions(loaderClient(runtime)),
          )
        },
      },
    ],
  })
}

/** Selected-graph adapter owning the standard Operator copy key and icon. */
export function createSelectedActionLedgerAdminExtension(
  { navMessages }: SelectedAdminExtensionFactoryContext = { navMessages: {} },
): AdminExtension {
  return createActionLedgerAdminExtension({
    labels: { actionLedger: navMessages.actionLedger ?? "Logs" },
    icon: ScrollText,
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the admin REST module takes — SSR
 * loaders run with the host runtime's cookie-forwarding fetcher.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
