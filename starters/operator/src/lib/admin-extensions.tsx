// agent-quality: file-size exception -- owner: operator; explicit source-controlled admin composition (one factory per domain) intentionally stays in one file.
import { useNavigate } from "@tanstack/react-router"
import { useOperatorAdminMessages } from "@voyant-travel/admin"
import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteMessagesProvider,
  type AdminUiRouteContribution,
  adminExtensionsFromGlob,
  adminRoutePageModule,
  createAdminExtensionRegistry,
} from "@voyant-travel/admin/extensions"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import { createOperatorProfileSettingsExtraPage } from "@voyant-travel/operator-settings-react/settings"
import { Button } from "@voyant-travel/ui/components/button"
import { Route, SlidersHorizontal } from "lucide-react"
import { generatedAdminExtensionFactories } from "@/admin.extensions.generated"
import type { AdminMessages } from "@/lib/admin-i18n"
import { effectiveAccessCatalog } from "../../.voyant/access/selected-access-catalog.generated"
import { createSelectedGraphAdminExtensions } from "../../.voyant/admin/selected-graph-admin.generated"

/**
 * Operator admin contributions composed through the shared admin runtime.
 *
 * Keep this explicit and source-controlled so the template still owns shell
 * composition while the extension seam stays typed and framework-level.
 *
 * Widget slots currently exposed by the operator starter:
 * - `dashboard.header`
 * - `dashboard.after-kpis`
 * - `dashboard.footer`
 * - `booking.details.header`
 * - `booking.details.after-summary`
 * - `booking.details.invoices-tab` (packaged: rendered by booking UI's
 *   `BookingDetailHost`; finance-ui contributes its invoices card here —
 *   the finance-ui ↔ booking UI cycle resolution)
 * - `person.details.bookings-tab` (packaged: rendered by relationships-ui's
 *   `PersonDetailHost`; booking UI contributes its person-bookings card
 *   here — the relationships-ui ↔ booking UI cycle resolution)
 * - `invoice.details.header`
 * - `invoice.details.after-summary`
 */

type AdminExtensionNavMessages = Pick<
  AdminMessages["nav"],
  | "actionLedger"
  | "allTrips"
  | "availability"
  | "bookings"
  | "catalogAccommodations"
  | "catalogCruises"
  | "catalogExcursions"
  | "catalogProducts"
  | "catalogTours"
  | "channelSync"
  | "categories"
  | "contractNumberSeries"
  | "contractTemplates"
  | "contracts"
  | "flights"
  | "invoiceNumberSeries"
  | "invoices"
  | "mice"
  | "newTrip"
  | "notificationDeliveries"
  | "notificationPreview"
  | "notificationReminderRules"
  | "notificationReminderRuns"
  | "notificationSettings"
  | "notificationTemplates"
  | "organizations"
  | "payments"
  | "people"
  | "policies"
  | "products"
  | "profitability"
  | "promotions"
  | "quotes"
  | "resources"
  | "supplierInvoices"
  | "suppliers"
  | "trips"
>

type RouteMessagesProviderLoader = NonNullable<AdminUiRouteContribution["routeMessagesProvider"]>

function loadProvider<TModule>(
  importer: () => Promise<TModule>,
  pick: (module: TModule) => AdminRouteMessagesProvider,
): RouteMessagesProviderLoader {
  return () => importer().then((module) => ({ default: pick(module) }))
}

function composeProviderLoaders(
  ...loaders: readonly RouteMessagesProviderLoader[]
): RouteMessagesProviderLoader {
  return async () => {
    const modules = await Promise.all(loaders.map((loader) => loader()))
    const Providers = modules.map((module) => module.default)

    const RouteMessagesProvider: AdminRouteMessagesProvider = ({ children, locale }) =>
      Providers.reduceRight(
        (content, Provider, index) => (
          <Provider key={Provider.displayName ?? Provider.name ?? index} locale={locale}>
            {content}
          </Provider>
        ),
        children,
      )

    RouteMessagesProvider.displayName = "OperatorRouteMessagesProvider"
    return { default: RouteMessagesProvider }
  }
}

const authMessagesProvider = loadProvider(
  () => import("@voyant-travel/auth-react/i18n"),
  (module) => module.AuthUiMessagesProvider,
)
const bookingsMessagesProvider = loadProvider(
  () => import("@voyant-travel/bookings-react/i18n"),
  (module) => module.BookingsUiMessagesProvider,
)
const catalogMessagesProvider = loadProvider(
  () => import("@voyant-travel/catalog-react/i18n"),
  (module) => module.CatalogUiMessagesProvider,
)
const commerceMessagesProvider = loadProvider(
  () => import("@voyant-travel/commerce-react/i18n"),
  (module) => module.CommerceUiMessagesProvider,
)
const distributionMessagesProvider = loadProvider(
  () => import("@voyant-travel/distribution-react/i18n"),
  (module) => module.DistributionUiMessagesProvider,
)
const financeMessagesProvider = loadProvider(
  () => import("@voyant-travel/finance-react/i18n"),
  (module) => module.FinanceUiMessagesProvider,
)
const productsMessagesProvider = loadProvider(
  () => import("@voyant-travel/inventory-react/i18n"),
  (module) => module.ProductsUiMessagesProvider,
)
const crmMessagesProvider = loadProvider(
  () => import("@voyant-travel/relationships-react/i18n"),
  (module) => module.CrmUiMessagesProvider,
)
const bookingRouteMessagesProvider = composeProviderLoaders(
  bookingsMessagesProvider,
  financeMessagesProvider,
  crmMessagesProvider,
  productsMessagesProvider,
  catalogMessagesProvider,
)
const coreRouteMessagesProviders: Record<string, RouteMessagesProviderLoader | undefined> = {
  "core-account": authMessagesProvider,
  "core-settings-api-tokens": authMessagesProvider,
  "core-settings-channels": distributionMessagesProvider,
  "core-settings-custom-fields": crmMessagesProvider,
  "core-settings-taxes": financeMessagesProvider,
  "core-settings-cost-categories": financeMessagesProvider,
  "core-settings-pricing-categories": commerceMessagesProvider,
  "core-settings-price-catalogs": commerceMessagesProvider,
  "core-settings-product-types": productsMessagesProvider,
  "core-settings-product-tags": productsMessagesProvider,
}

const extensionRouteMessagesProviders: Record<string, RouteMessagesProviderLoader | undefined> = {
  bookings: bookingRouteMessagesProvider,
  catalog: catalogMessagesProvider,
  inventory: productsMessagesProvider,
}

function withRouteMessagesProvider(
  extension: AdminExtension,
  routeMessagesProvider: RouteMessagesProviderLoader | undefined,
): AdminExtension {
  if (!extension.routes?.length) return extension

  const applyToRoute = (route: AdminUiRouteContribution): AdminUiRouteContribution => {
    const provider =
      extension.id === "core"
        ? coreRouteMessagesProviders[route.id]
        : route.redirectTo
          ? undefined
          : routeMessagesProvider

    return {
      ...route,
      routeMessagesProvider: route.routeMessagesProvider ?? provider,
      children: route.children?.map(applyToRoute),
    }
  }

  return {
    ...extension,
    routes: extension.routes.map(applyToRoute),
  }
}

function withOperatorRouteMessagesProviders(
  extensions: ReadonlyArray<AdminExtension>,
): ReadonlyArray<AdminExtension> {
  return extensions.map((extension) =>
    withRouteMessagesProvider(extension, extensionRouteMessagesProviders[extension.id]),
  )
}

// The CORE admin surfaces — dashboard, account, settings — are
// package-delivered by `@voyant-travel/admin-app/core-extension` (packaged-admin RFC §4.2): the
// extension contributes NO navigation (Dashboard/Settings are part of the
// BASE operator navigation; Account is linked from the user menu) and is
// registered for the routes seam. The app composes two seams through the
// factory options:
// - the dashboard SSR loader: the operator prefetches the dashboard
//   aggregates through TanStack Start server functions that read the
//   database directly (cookie-authenticated), which no package can own —
//   the package page consumes the same dashboard query keys client-side.
// - the Operator Profile settings page: package-delivered by
//   `@voyant-travel/operator-settings-react` (it talks to the
//   `/v1/admin/settings/operator-*` endpoints), spliced into the packaged
//   settings layout as an extra page, leading the General group — the same
//   descriptor the source-free managed admin mounts.
function createCoreExtension() {
  return createAdminCoreExtension({
    dashboard: {
      // Dynamic import on purpose: the SSR query options pull the server-fn
      // module, and a static import here would pin it into the
      // workspace-chrome chunk that evaluates this registry.
      loader: async ({ queryClient }: AdminRouteLoaderContext) => {
        const {
          getOperatorDashboardBookingsAggregatesQueryOptions,
          getOperatorDashboardFinanceAggregatesQueryOptions,
          getOperatorDashboardProductsAggregatesQueryOptions,
          getOperatorDashboardSuppliersAggregatesQueryOptions,
        } = await import("@/lib/dashboard-ssr-query-options")
        await Promise.all([
          queryClient.ensureQueryData(getOperatorDashboardBookingsAggregatesQueryOptions()),
          queryClient.ensureQueryData(getOperatorDashboardProductsAggregatesQueryOptions()),
          queryClient.ensureQueryData(getOperatorDashboardSuppliersAggregatesQueryOptions()),
          queryClient.ensureQueryData(getOperatorDashboardFinanceAggregatesQueryOptions()),
        ])
      },
    },
    settings: {
      accessCatalog: effectiveAccessCatalog,
      extraPages: [
        // The Operator Profile page is now package-delivered
        // (@voyant-travel/operator-settings-react) so the source-free managed
        // admin can render the same page; the starter mounts the packaged
        // descriptor instead of an app-custom source component.
        createOperatorProfileSettingsExtraPage(),
        {
          id: "custom-fields",
          path: "/custom-fields",
          title: "Custom Fields",
          label: "Custom fields",
          icon: SlidersHorizontal,
          group: "general",
          order: 75,
          ssr: "data-only",
          page: () =>
            import(
              "@voyant-travel/relationships-react/components/custom-field-definitions-page"
            ).then((module) => adminRoutePageModule(module.CustomFieldDefinitionsPage)),
          loader: async ({ queryClient, runtime }: AdminRouteLoaderContext) => {
            const [{ defaultFetcher }, { getCustomFieldDefinitionsQueryOptions }] =
              await Promise.all([
                import("@voyant-travel/relationships-react/client"),
                import("@voyant-travel/relationships-react"),
              ])
            return queryClient.ensureQueryData(
              getCustomFieldDefinitionsQueryOptions(
                { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher },
                { limit: 25, offset: 0 },
              ),
            )
          },
        },
      ],
    },
  })
}

// App-owned header action on the package-delivered bookings list: composing
// a trip is an operator concept (the trips pages are app-custom),
// so the button rides in through the extension factory's
// `indexHeaderActions` option instead of a host route file.
function ComposeTripButton() {
  const navigate = useNavigate()
  const composeTrip = useOperatorAdminMessages().trips.list.composeTrip

  return (
    <Button
      variant="outline"
      onClick={() => void navigate({ to: "/trips/$id", params: { id: "new" } })}
    >
      <Route className="size-4" aria-hidden="true" />
      {composeTrip}
    </Button>
  )
}

// Bookings is package-delivered (packaged-admin RFC Phase 3 + §4.8): the
// extension contributes NO navigation — the Bookings item is part of the BASE
// operator navigation (createOperatorAdminNavigation in @voyant-travel/admin), so
// an entry here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route implementations + search
// contracts (bookingsIndexSearchSchema / bookingDetailSearchSchema /
// bookingNewSearchSchema / bookingJourneySearchSchema) for the whole booking
// flow — list, detail, the /bookings/new product picker, the
// /bookings/compose composer alias, and the unified booking journey at
// /catalog/journey/$entityModule/$entityId — and the host assembles them
// into its code-based route tree, no route files. The app composes two seams
// through factory options: the "Compose trip" header action on the list, and
// the detail-page substitution (the operator wraps the packaged
// BookingDetailHost with the checkout/finance payment dialogs, which the
// package cannot import without a dependency cycle).
function createBookingsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.bookings({
    labels: { bookings: messages.bookings },
    indexHeaderActions: <ComposeTripButton />,
    detailPageComponent: () =>
      import("@/components/voyant/bookings/booking-detail-page").then((module) => ({
        default: module.BookingDetailPage,
      })),
  })
}

// Catalog is package-delivered (packaged-admin RFC Phase 2): the extension
// contributes NO navigation — the Catalog group is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyant-travel/admin), so entries
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata + search contracts
// (catalogSearchSchema / productDetailSearchSchema), and the pages are the
// packaged hosts from @voyant-travel/catalog-react/admin — the route files under
// src/routes/_workspace/catalog/* only bind route params/search onto them.
function createCatalogExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.catalog({
    defaultLocale: "en-GB",
    defaultMarket: "default",
    scopeStrategy: "deployment-default",
    hideScopeControls: true,
    labels: {
      products: messages.catalogProducts,
      excursions: messages.catalogExcursions,
      tours: messages.catalogTours,
      cruises: messages.catalogCruises,
      accommodations: messages.catalogAccommodations,
    },
  })
}

// Products is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Products item (with its Categories
// sub-item) is part of the BASE operator navigation
// (createOperatorAdminNavigation in @voyant-travel/admin), so entries here would
// duplicate it. It's registered for the routes seam: the contributions carry
// the package-owned route implementations (no search contracts — the pages
// keep their filters local), and the list/categories pages are the packaged
// hosts from @voyant-travel/inventory-react/admin. The detail page is substituted
// through the factory's `detailPageComponent` seam: the operator wrapper
// composes the app-owned pieces the package cannot import — the
// availability-react option resource templates panel (availability-react
// depends on products-react, so importing it there would be a cycle), the
// app's /api/v1/admin/uploads storage route, and the product-pre-selected
// new-booking deep link.
function createProductsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.inventory({
    labels: { products: messages.products, categories: messages.categories },
    detailPageComponent: () =>
      import("@/components/voyant/products/product-detail-page").then((module) => ({
        default: module.ProductDetailPage,
      })),
  })
}

const defaultExtensionNavMessages: AdminExtensionNavMessages = {
  actionLedger: "Logs",
  allTrips: "All trips",
  availability: "Availability",
  bookings: "Bookings",
  catalogAccommodations: "Accommodations",
  catalogCruises: "Cruises",
  catalogExcursions: "Excursions",
  catalogProducts: "Packages",
  catalogTours: "Tours",
  channelSync: "Distribution",
  categories: "Categories",
  contractNumberSeries: "Number Series",
  contractTemplates: "Contract Templates",
  contracts: "Contracts",
  flights: "Flights",
  invoiceNumberSeries: "Number Series",
  invoices: "Invoices",
  mice: "Programs",
  newTrip: "New trip",
  notificationDeliveries: "Deliveries",
  notificationPreview: "Preview",
  notificationReminderRules: "Reminder Rules",
  notificationReminderRuns: "Reminder Runs",
  notificationSettings: "Settings",
  notificationTemplates: "Templates",
  organizations: "Organizations",
  payments: "Payments",
  people: "People",
  policies: "Policies",
  products: "Products",
  profitability: "Profitability",
  promotions: "Promotions",
  quotes: "Quotes",
  resources: "Resources",
  supplierInvoices: "Supplier invoices",
  suppliers: "Suppliers",
  trips: "Trips",
}

/**
 * Deployment-local admin extensions dropped into `src/admin/<name>/index.tsx`
 * (custom dashboard/detail widgets, nav entries, and pages) — auto-discovered
 * and composed alongside the standard set, no framework edit, upgrade-safe. Vite
 * compiles this `import.meta.glob` to static imports at build time (Workers-safe).
 * Their nav/widgets compose here; their page routes are grafted into the route
 * tree by `router.tsx` (via `buildAdminExtensionRoutes`). Empty until a
 * deployment adds one. See docs/architecture/custom-modules.md.
 */
export const discoveredAdminExtensions = adminExtensionsFromGlob(
  import.meta.glob("../admin/*/index.tsx", { eager: true }),
)

export function createOperatorAdminExtensions(
  messages: AdminExtensionNavMessages,
): ReadonlyArray<AdminExtension> {
  return withOperatorRouteMessagesProviders(
    createAdminExtensionRegistry(
      createCoreExtension(),
      createBookingsExtension(messages),
      createCatalogExtension(messages),
      createProductsExtension(messages),
      ...createSelectedGraphAdminExtensions({ navMessages: messages }),
      ...discoveredAdminExtensions,
    ),
  )
}

export const adminExtensions: ReadonlyArray<AdminExtension> = createOperatorAdminExtensions(
  defaultExtensionNavMessages,
)
