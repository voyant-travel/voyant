import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyantjs/admin"

import {
  defaultFetcher,
  getSupplierNotesQueryOptions,
  getSupplierQueryOptions,
  getSupplierServiceRatesQueryOptions,
  getSupplierServicesQueryOptions,
  getSuppliersQueryOptions,
} from "../index.js"
import { SupplierDetailSkeleton } from "./supplier-detail-skeleton.js"
import { SuppliersListSkeleton } from "./suppliers-list-skeleton.js"

/**
 * Semantic destinations the suppliers admin surfaces navigate to
 * (packaged-admin RFC §4.7). The supplier pages link between the list and
 * the detail page, so instead of importing a host route tree they resolve
 * these keys through `useAdminHref`/`useAdminNavigate` from
 * `@voyantjs/admin`. Hosts register one resolver per key
 * (`satisfies AdminDestinationResolvers`).
 *
 * `supplier.detail` is also declared by `@voyantjs/catalog-react/admin` and
 * `@voyantjs/finance-react/admin` — interface merging requires the member shape
 * to stay identical across packages.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The suppliers list page. */
    "supplier.list": Record<string, never>
    /** A supplier's detail page. */
    "supplier.detail": { supplierId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the supplier pages
// bound to their data wiring + semantic-destination navigation. Host route
// files only bind route params onto these.
export {
  SupplierDetailHost,
  type SupplierDetailHostProps,
  type SupplierDetailHostSlotContext,
  supplierDetailPaymentPolicySlot,
} from "./supplier-detail-host.js"
export { SupplierDetailSkeleton } from "./supplier-detail-skeleton.js"
export { SuppliersHost } from "./suppliers-host.js"
export { SuppliersListSkeleton } from "./suppliers-list-skeleton.js"

export interface CreateSuppliersAdminExtensionOptions {
  /** Mount path of the supplier pages inside the admin workspace. Default `/suppliers`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    suppliers?: string
  }
}

/**
 * The suppliers admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Suppliers nav item is part of the BASE
 * operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing nav entries here would duplicate it.
 * If the base nav ever drops the suppliers item, this extension is where the
 * entry moves.
 *
 * ROUTES: contributions carry the FULL route implementation (packaged-admin
 * RFC §4.2/§4.8) — lazy `page` module loaders, data loaders fed by the
 * host-supplied {@link AdminRouteLoaderContext} (QueryClient + runtime +
 * params), per-route SSR mode, and pending skeletons. Hosts bind them into
 * their code-assembled admin route tree; no per-route host files needed.
 * The pages stay code-split because each contribution's `page` dynamically
 * imports the specific host/page module — never the admin barrel — so the
 * heavy page chunks load on navigation, not with workspace chrome.
 * {@link SuppliersHost} mounts as a zero-prop page; the detail page reads
 * the supplier id from {@link AdminRoutePageProps} via the default-exported
 * wrapper in `./pages/`. The list carries no URL search state (filters stay
 * local), so no `validateSearch` contracts. The pages bind to their data
 * wiring (the shared suppliers provider context) and resolve every
 * cross-route link through the semantic destinations declared above — no
 * app RPC client, no host route tree.
 *
 * WIDGETS: none contributed, but {@link SupplierDetailHost} exposes the
 * `supplier.details.payment-policy` slot ({@link
 * supplierDetailPaymentPolicySlot}) — the §4.7 cycle resolution that lets
 * `@voyantjs/finance-react/ui` (which depends on this package) contribute the
 * finance-owned customer-payment-policy card to the supplier detail page.
 */
export function createSuppliersAdminExtension(
  options: CreateSuppliersAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/suppliers", labels = {} } = options
  const { suppliers = "Suppliers" } = labels

  return defineAdminExtension({
    id: "suppliers",
    routes: [
      {
        id: "suppliers-index",
        path: basePath,
        title: suppliers,
        ssr: "data-only",
        page: () =>
          import("./suppliers-host.js").then((module) =>
            adminRoutePageModule(module.SuppliersHost),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(getSuppliersQueryOptions(loaderClient(runtime))),
        pendingComponent: SuppliersListSkeleton,
      },
      {
        id: "suppliers-detail",
        path: `${basePath}/$id`,
        title: suppliers,
        page: () => import("./pages/supplier-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = loaderClient(runtime)
          const servicesData = await queryClient.ensureQueryData(
            getSupplierServicesQueryOptions(client, id),
          )

          await Promise.all([
            queryClient.ensureQueryData(getSupplierQueryOptions(client, id)),
            queryClient.ensureQueryData(getSupplierNotesQueryOptions(client, id)),
            ...servicesData.data.map((service) =>
              queryClient.ensureQueryData(
                getSupplierServiceRatesQueryOptions(client, id, service.id),
              ),
            ),
          ])
        },
        pendingComponent: SupplierDetailSkeleton,
      },
    ],
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the supplier query options take.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
