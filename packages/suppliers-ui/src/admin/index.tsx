import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"

/**
 * Semantic destinations the suppliers admin surfaces navigate to
 * (packaged-admin RFC §4.7). The supplier pages link between the list and
 * the detail page, so instead of importing a host route tree they resolve
 * these keys through `useAdminHref`/`useAdminNavigate` from
 * `@voyantjs/admin`. Hosts register one resolver per key
 * (`satisfies AdminDestinationResolvers`).
 *
 * `supplier.detail` is also declared by `@voyantjs/catalog-ui/admin` and
 * `@voyantjs/finance-ui/admin` — interface merging requires the member shape
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
 * ROUTES: contributions are metadata only — the supplier pages carry no URL
 * search state (the list keeps its filters local). The PAGES are
 * package-owned: {@link SuppliersHost} (zero-prop, attachable directly as a
 * route `component:`) and {@link SupplierDetailHost} bind the canonical
 * supplier pages to their data wiring (the shared suppliers provider
 * context) and resolve every cross-route link through the semantic
 * destinations declared above — no app RPC client, no host route tree.
 *
 * `component:` is intentionally NOT attached to these contributions yet:
 * the contribution contract renders zero-prop pages (route components read
 * params via the router, per RFC §4.2), and {@link SupplierDetailHost}
 * takes the supplier id as a prop. Host route files stay the thin binding
 * layer (`Route.useParams()` → host props) until the §4.2 code-based route
 * assembly gives packaged pages a router-agnostic way to read route state.
 *
 * WIDGETS: none contributed, but {@link SupplierDetailHost} exposes the
 * `supplier.details.payment-policy` slot ({@link
 * supplierDetailPaymentPolicySlot}) — the §4.7 cycle resolution that lets
 * `@voyantjs/finance-ui` (which depends on this package) contribute the
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
      },
      {
        id: "suppliers-detail",
        path: `${basePath}/$id`,
        title: suppliers,
      },
    ],
  })
}
