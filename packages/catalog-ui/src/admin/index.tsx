import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"
import { catalogSearchSchema } from "@voyantjs/catalog-react"
import { z } from "zod"

import type { CatalogDetailSurface } from "../catalog-surfaces.js"

/**
 * Semantic destinations the catalog admin surfaces navigate to (packaged-admin
 * RFC §4.7). The catalog pages link into routes they do not own — the booking
 * journey, the supplier page, the product editor — so instead of importing a
 * host route tree they resolve these keys through
 * `useAdminHref`/`useAdminNavigate` from `@voyantjs/admin`. Hosts register one
 * resolver per key (`satisfies AdminDestinationResolvers`).
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /**
     * The unified booking journey wizard for an offer-carrying entity.
     * Optional fields pre-pin the journey: a departure (by id for owned
     * inventory, by date for sourced), an option/cabin, an accommodation rate
     * (room type + rate plan + board), and name/image for the side-panel
     * preview. Pass only the fields the selection actually carries — key
     * presence is meaningful to the journey's search params.
     */
    "bookingJourney.start": {
      /** Entity module owning the bookable entity (e.g. `"products"`, `"cruises"`). */
      entityModule: string
      entityId: string
      /** Offer source kind (e.g. `"owned"`, `"voyant-connect"`). */
      sourceKind: string
      sourceConnectionId?: string
      sourceRef?: string
      departureId?: string
      /** ISO date (YYYY-MM-DD). */
      departureDate?: string
      optionId?: string
      roomTypeId?: string
      ratePlanId?: string
      board?: string
      entityName?: string
      entityImageUrl?: string
    }
    /** A catalog surface's browse page (e.g. Packages, Cruises). */
    "catalog.browse": { surface: CatalogDetailSurface }
    /**
     * A catalog surface's dedicated detail page. `adults`/`nights` carry the
     * package search context so live offers match what was searched.
     */
    "catalog.detail": {
      surface: CatalogDetailSurface
      id: string
      adults?: number
      nights?: number
    }
    /** The owned-product editor/detail page. */
    "product.detail": { productId: string }
    /** A supplier's detail page. */
    "supplier.detail": { supplierId: string }
  }
}

export { type CatalogSearchParams, catalogSearchSchema } from "@voyantjs/catalog-react"
// Packaged pages + taxonomy consumed by host route files / host wrappers, so
// thin hosts can import everything catalog-admin from this one entrypoint.
export {
  type CatalogDetailSurface,
  catalogDetailSurfaces,
  catalogSurfaceVertical,
} from "../catalog-surfaces.js"
export { CatalogPage, type CatalogPageProps } from "../components/catalog-page.js"
export {
  type CatalogVerticalDetailBreadcrumb,
  CatalogVerticalDetailPage,
  type CatalogVerticalDetailPageProps,
} from "../components/catalog-vertical-detail-page.js"
export { CruiseDetailPage, type CruiseDetailPageProps } from "../components/cruise-detail-page.js"
export {
  DynamicCatalogPage,
  type DynamicCatalogPageProps,
} from "../components/dynamic-catalog-page.js"
export {
  type ProductBookSelection,
  ProductDetailPage,
  type ProductDetailPageProps,
} from "../components/product-detail-page.js"
export {
  ScheduledCatalogPage,
  type ScheduledCatalogPageProps,
  type ScheduledScope,
} from "../components/scheduled-catalog-page.js"

/**
 * Search context carried onto the product detail page so live offers match
 * what the operator searched (occupancy + length of stay) and the right
 * locale loads. Package-owned so the detail page and its hosts validate the
 * same contract.
 */
export const productDetailSearchSchema = z.object({
  adults: z.coerce.number().int().min(1).optional(),
  nights: z.coerce.number().int().min(1).optional(),
  locale: z.string().optional(),
})

export type ProductDetailSearchParams = z.infer<typeof productDetailSearchSchema>

export interface CreateCatalogAdminExtensionOptions {
  /** Mount path of the catalog surfaces inside the admin workspace. Default `/catalog`. */
  basePath?: string
  /** Localized surface labels. Defaults are the English operator nav labels. */
  labels?: {
    products?: string
    excursions?: string
    tours?: string
    cruises?: string
    accommodations?: string
  }
}

/**
 * The catalog admin contribution (packaged-admin RFC Phase 2,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Catalog nav group (with its five surface
 * sub-items) is part of the BASE operator navigation — see
 * `createOperatorAdminNavigation` in `@voyantjs/admin` — so contributing nav
 * entries here would duplicate them. If the base nav ever drops the catalog
 * group, this extension is where the entries move.
 *
 * ROUTES: contributions are metadata + the package-owned search contracts
 * (`catalogSearchSchema` from `@voyantjs/catalog-react` for the browse
 * surfaces, {@link productDetailSearchSchema} for the package detail page).
 * `component`/`loader` are intentionally NOT carried yet: every catalog page
 * the operator mounts is wrapped by an app-local host
 * (`templates/operator/src/components/voyant/catalog/*`) that binds
 * operator-only concerns — typed router navigation into the booking journey /
 * supplier / product-editor routes, and (for the browse grid) the app's Hono
 * RPC client. The navigation half of that gap is now closed by the semantic
 * destinations declared above (`AdminDestinations` augmentation +
 * `useAdminHref`/`useAdminNavigate`); once the wrappers are converted, the
 * remaining host concern is the RPC client. Until then the route files stay
 * authoritative for rendering and these contributions describe the seam.
 */
export function createCatalogAdminExtension(
  options: CreateCatalogAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/catalog", labels = {} } = options
  const {
    products = "Packages",
    excursions = "Excursions",
    tours = "Tours",
    cruises = "Cruises",
    accommodations = "Accommodations",
  } = labels

  const browseSearch = (search: Record<string, unknown>) => catalogSearchSchema.parse(search)
  const productDetailSearch = (search: Record<string, unknown>) =>
    productDetailSearchSchema.parse(search)

  return defineAdminExtension({
    id: "catalog",
    routes: [
      {
        id: "catalog-products-index",
        path: `${basePath}/products`,
        title: products,
        validateSearch: browseSearch,
      },
      {
        id: "catalog-products-detail",
        path: `${basePath}/products/$productId`,
        title: products,
        validateSearch: productDetailSearch,
      },
      {
        id: "catalog-excursions-index",
        path: `${basePath}/excursions`,
        title: excursions,
        validateSearch: browseSearch,
      },
      {
        id: "catalog-excursions-detail",
        path: `${basePath}/excursions/$id`,
        title: excursions,
      },
      {
        id: "catalog-tours-index",
        path: `${basePath}/tours`,
        title: tours,
        validateSearch: browseSearch,
      },
      {
        id: "catalog-tours-detail",
        path: `${basePath}/tours/$id`,
        title: tours,
      },
      {
        id: "catalog-cruises-index",
        path: `${basePath}/cruises`,
        title: cruises,
        validateSearch: browseSearch,
      },
      {
        id: "catalog-cruises-detail",
        path: `${basePath}/cruises/$id`,
        title: cruises,
      },
      {
        id: "catalog-accommodations-index",
        path: `${basePath}/accommodations`,
        title: accommodations,
        validateSearch: browseSearch,
      },
      {
        id: "catalog-accommodations-detail",
        path: `${basePath}/accommodations/$id`,
        title: accommodations,
      },
    ],
  })
}
