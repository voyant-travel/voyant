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
import { SlidersHorizontal } from "lucide-react"
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

const authMessagesProvider = loadProvider(
  () => import("@voyant-travel/auth-react/i18n"),
  (module) => module.AuthUiMessagesProvider,
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

function withCoreRouteMessagesProviders(extension: AdminExtension): AdminExtension {
  if (!extension.routes?.length) return extension

  const applyToRoute = (route: AdminUiRouteContribution): AdminUiRouteContribution => {
    const provider = route.redirectTo ? undefined : coreRouteMessagesProviders[route.id]

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
    extension.id === "core" ? withCoreRouteMessagesProviders(extension) : extension,
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
      ...createSelectedGraphAdminExtensions({ navMessages: messages }),
      ...discoveredAdminExtensions,
    ),
  )
}

export const adminExtensions: ReadonlyArray<AdminExtension> = createOperatorAdminExtensions(
  defaultExtensionNavMessages,
)
