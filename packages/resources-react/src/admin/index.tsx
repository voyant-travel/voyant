import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyantjs/admin"

import { ResourceAllocationDetailSkeleton } from "../components/resource-allocation-detail-page.js"
import { ResourceAssignmentDetailSkeleton } from "../components/resource-assignment-detail-page.js"
import {
  ensureResourceAllocationDetailPageData,
  ensureResourceAssignmentDetailPageData,
  ensureResourceDetailPageData,
  ensureResourcePoolDetailPageData,
} from "../components/resource-detail-data.js"
import { ResourceDetailSkeleton } from "../components/resource-detail-page.js"
import { ResourcePoolDetailSkeleton } from "../components/resource-pool-detail-page.js"
import { defaultFetcher } from "../index.js"
import { ensureResourcesPageData } from "./resources-page-data.js"
import { ResourcesPageSkeleton } from "./resources-page-skeleton.js"

/**
 * Semantic destinations the resources admin surfaces navigate to
 * (packaged-admin RFC §4.7). The tab dashboard links into the four detail
 * pages, the detail pages link back to the dashboard and across to the
 * supplier/product/availability-slot pages — instead of importing a host
 * route tree they resolve these keys through `useAdminHref`/
 * `useAdminNavigate` from `@voyantjs/admin`. Hosts register one resolver
 * per key (`satisfies AdminDestinationResolvers`).
 *
 * `supplier.detail`, `product.detail` and `availabilitySlot.detail` are
 * also declared by other domain packages (suppliers-ui / catalog-ui /
 * bookings-ui) — interface merging requires the member shape to stay
 * identical across packages.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The resources tab dashboard. */
    "resource.list": Record<string, never>
    /** A resource's detail page. */
    "resource.detail": { resourceId: string }
    /** A resource pool's detail page. */
    "resourcePool.detail": { poolId: string }
    /** A resource allocation's detail page. */
    "resourceAllocation.detail": { allocationId: string }
    /** A slot assignment's detail page. */
    "resourceAssignment.detail": { assignmentId: string }
    /** A supplier's detail page. */
    "supplier.detail": { supplierId: string }
    /** A product's detail page. */
    "product.detail": { productId: string }
    /** An availability slot's detail page. */
    "availabilitySlot.detail": { slotId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the resources pages
// bound to their data wiring + semantic-destination navigation. Host route
// files only bind route params onto these.
export {
  ResourceAllocationDetailHost,
  type ResourceAllocationDetailHostProps,
  ResourceAssignmentDetailHost,
  type ResourceAssignmentDetailHostProps,
  ResourceDetailHost,
  type ResourceDetailHostProps,
  ResourcePoolDetailHost,
  type ResourcePoolDetailHostProps,
} from "./detail-hosts.js"
export type { BatchMutationResponse } from "./resources-admin-api.js"
export { ResourceAllocationDialog } from "./resources-dialog-allocation.js"
export { ResourcesDialogs } from "./resources-dialogs.js"
export { ResourceDialog, ResourcePoolDialog } from "./resources-dialogs-core.js"
export { ResourceCloseoutDialog, ResourceSlotAssignmentDialog } from "./resources-dialogs-ops.js"
export { ResourcesHost } from "./resources-host.js"
export { ensureResourcesPageData, resourcesPageQueryFilters } from "./resources-page-data.js"
export { ResourcesBodySkeleton, ResourcesPageSkeleton } from "./resources-page-skeleton.js"

export interface CreateResourcesAdminExtensionOptions {
  /** Mount path of the resources pages inside the admin workspace. Default `/resources`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    resources?: string
  }
}

/**
 * The resources admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Resources nav item is part of the BASE
 * operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing nav entries here would duplicate it.
 * If the base nav ever drops the resources item, this extension is where
 * the entry moves.
 *
 * ROUTES: contributions carry the FULL route implementation (packaged-admin
 * RFC §4.2/§4.8) — lazy `page` module loaders, data loaders fed by the
 * host-supplied {@link AdminRouteLoaderContext} (QueryClient + runtime +
 * params), per-route SSR mode, and pending skeletons. Hosts bind them into
 * their code-assembled admin route tree; no per-route host files needed.
 * The pages stay code-split because each contribution's `page` dynamically
 * imports the specific host/page module — never the admin barrel — so the
 * heavy page chunks load on navigation, not with workspace chrome.
 * {@link ResourcesHost} (the tab dashboard) mounts as a zero-prop page; the
 * four detail hosts read their entity id from `AdminRoutePageProps` via the
 * default-exported wrappers in `./pages/`. The dashboard keeps its
 * tab/filter state local, so there are no URL search contracts, and every
 * cross-route link resolves through the semantic destinations declared
 * above — no app RPC client, no host route tree.
 *
 * WIDGETS: none contributed and no slots exposed yet.
 */
export function createResourcesAdminExtension(
  options: CreateResourcesAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/resources", labels = {} } = options
  const { resources = "Resources" } = labels

  return defineAdminExtension({
    id: "resources",
    routes: [
      {
        id: "resources-index",
        path: basePath,
        title: resources,
        ssr: "data-only",
        page: () =>
          import("./resources-host.js").then((module) =>
            adminRoutePageModule(module.ResourcesHost),
          ),
        // Awaits only the default tab's query and fires the rest as
        // background prefetches (same filters as the page's hooks, so the
        // cache seeds line up).
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          ensureResourcesPageData(queryClient, loaderClient(runtime)),
        pendingComponent: ResourcesPageSkeleton,
      },
      {
        id: "resources-detail",
        path: `${basePath}/$id`,
        title: resources,
        ssr: "data-only",
        page: () => import("./pages/resource-detail-page.js"),
        loader: ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          return ensureResourceDetailPageData(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: ResourceDetailSkeleton,
      },
      {
        id: "resources-pool-detail",
        path: `${basePath}/pools/$id`,
        title: resources,
        ssr: "data-only",
        page: () => import("./pages/resource-pool-detail-page.js"),
        loader: ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          return ensureResourcePoolDetailPageData(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: ResourcePoolDetailSkeleton,
      },
      {
        id: "resources-assignment-detail",
        path: `${basePath}/assignments/$id`,
        title: resources,
        ssr: "data-only",
        page: () => import("./pages/resource-assignment-detail-page.js"),
        loader: ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          return ensureResourceAssignmentDetailPageData(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: ResourceAssignmentDetailSkeleton,
      },
      {
        id: "resources-allocation-detail",
        path: `${basePath}/allocations/$id`,
        title: resources,
        ssr: "data-only",
        page: () => import("./pages/resource-allocation-detail-page.js"),
        loader: ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          return ensureResourceAllocationDetailPageData(queryClient, loaderClient(runtime), id)
        },
        pendingComponent: ResourceAllocationDetailSkeleton,
      },
    ],
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the resources loaders take — SSR
 * loaders run with the host runtime's cookie-forwarding fetcher.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
