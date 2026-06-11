import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"

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
  /** Localized page title. Default is the English operator nav label. */
  label?: string
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
 * ROUTES: contributions are metadata only — the resources pages carry no
 * URL search state (the dashboard keeps its tab/filter state local). The
 * PAGES are package-owned: {@link ResourcesHost} (zero-prop, attachable
 * directly as a route `component:`) plus the four detail hosts bind the
 * canonical pages to their data wiring (the shared resources provider
 * context) and resolve every cross-route link through the semantic
 * destinations declared above — no app RPC client, no host route tree.
 *
 * `component:` is intentionally NOT attached to these contributions yet:
 * the contribution contract renders zero-prop pages (route components read
 * params via the router, per RFC §4.2), and the detail hosts take the
 * entity id as a prop. Host route files stay the thin binding layer
 * (`Route.useParams()` → host props) until the §4.2 code-based route
 * assembly gives packaged pages a router-agnostic way to read route state.
 *
 * WIDGETS: none contributed and no slots exposed yet.
 */
export function createResourcesAdminExtension(
  options: CreateResourcesAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/resources", label = "Resources" } = options

  return defineAdminExtension({
    id: "resources",
    routes: [
      {
        id: "resources-index",
        path: basePath,
        title: label,
      },
      {
        id: "resources-detail",
        path: `${basePath}/$id`,
        title: label,
      },
      {
        id: "resources-pool-detail",
        path: `${basePath}/pools/$id`,
        title: label,
      },
      {
        id: "resources-assignment-detail",
        path: `${basePath}/assignments/$id`,
        title: label,
      },
      {
        id: "resources-allocation-detail",
        path: `${basePath}/allocations/$id`,
        title: label,
      },
    ],
  })
}
