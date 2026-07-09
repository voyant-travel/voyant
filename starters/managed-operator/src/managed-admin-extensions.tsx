// agent-quality: file-size exception -- owner: managed-operator; explicit
// source-free admin composition (one factory per domain) intentionally stays
// in one file, mirroring starters/operator/src/lib/admin-extensions.tsx.

import { createActionLedgerAdminExtension } from "@voyant-travel/action-ledger-react/admin"
import {
  type AdminExtension,
  type AdminRouteMessagesProvider,
  type AdminUiRouteContribution,
  createAdminExtensionRegistry,
} from "@voyant-travel/admin/extensions"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import { createBookingsAdminExtension } from "@voyant-travel/bookings-react/admin"
import { createCatalogAdminExtension } from "@voyant-travel/catalog-react/admin"
import { createCommerceAdminExtension } from "@voyant-travel/commerce-react/admin"
import { createDistributionAdminExtension } from "@voyant-travel/distribution-react/admin"
import { createFinanceAdminExtension } from "@voyant-travel/finance-react/admin"
import { createFlightsAdminExtension } from "@voyant-travel/flights-react/admin"
import { createInventoryAdminExtension } from "@voyant-travel/inventory-react/admin"
import { createLegalAdminExtension } from "@voyant-travel/legal-react/admin"
import { createMiceAdminExtension } from "@voyant-travel/mice-react/admin"
import { createNotificationsAdminExtension } from "@voyant-travel/notifications-react/admin"
import { createOperationsAdminExtension } from "@voyant-travel/operations-react/admin"
import { createOperatorProfileSettingsExtraPage } from "@voyant-travel/operator-settings-react/settings"
import { createQuotesAdminExtension } from "@voyant-travel/quotes-react/admin"
import { createRelationshipsAdminExtension } from "@voyant-travel/relationships-react/admin"
import { createTripsAdminExtension } from "@voyant-travel/trips-react/admin"

/**
 * The SOURCE-FREE, PACKAGE-ONLY admin extension registry for the managed
 * operator host — the full Voyant admin composed entirely from published
 * packages (no `@/lib/*`, no source-controlled domain modules).
 *
 * This mirrors `starters/operator/src/lib/admin-extensions.tsx`
 * (`createOperatorAdminExtensions`): it calls every standard domain's
 * `create<Module>AdminExtension` factory and grafts each domain's lazy i18n
 * route-message provider onto its routes so the pages render with their
 * messages.
 *
 * DELIBERATELY DEFERRED (enhancements, not needed for an all-modules admin):
 * - cross-package WIDGET-SLOT wiring (invoice-card-in-booking-tab,
 *   person-bookings-tab, dashboard widgets)
 * - the semantic DESTINATIONS resolver map
 * Every factory below defaults such options, so omitting them is safe.
 *
 * Labels are left at their factory defaults (English) — the managed host does
 * not own a localized nav-messages catalog, and each factory falls back to a
 * sensible English string when `labels` is omitted.
 */

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

    RouteMessagesProvider.displayName = "ManagedRouteMessagesProvider"
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
const suppliersMessagesProvider = loadProvider(
  () => import("@voyant-travel/distribution-react/suppliers/i18n"),
  (module) => module.SuppliersUiMessagesProvider,
)
const financeMessagesProvider = loadProvider(
  () => import("@voyant-travel/finance-react/i18n"),
  (module) => module.FinanceUiMessagesProvider,
)
const flightsMessagesProvider = loadProvider(
  () => import("@voyant-travel/flights-react/i18n"),
  (module) => module.FlightsUiMessagesProvider,
)
const productsMessagesProvider = loadProvider(
  () => import("@voyant-travel/inventory-react/i18n"),
  (module) => module.ProductsUiMessagesProvider,
)
const legalMessagesProvider = loadProvider(
  () => import("@voyant-travel/legal-react/i18n"),
  (module) => module.LegalUiMessagesProvider,
)
const notificationsMessagesProvider = loadProvider(
  () => import("@voyant-travel/notifications-react/i18n"),
  (module) => module.NotificationsUiMessagesProvider,
)
const allocationMessagesProvider = loadProvider(
  () => import("@voyant-travel/operations-react/availability/allocation/i18n"),
  (module) => module.AllocationUiMessagesProvider,
)
const availabilityMessagesProvider = loadProvider(
  () => import("@voyant-travel/operations-react/availability/i18n"),
  (module) => module.AvailabilityUiMessagesProvider,
)
const resourcesMessagesProvider = loadProvider(
  () => import("@voyant-travel/operations-react/resources/i18n"),
  (module) => module.ResourcesUiMessagesProvider,
)
const crmMessagesProvider = loadProvider(
  () => import("@voyant-travel/relationships-react/i18n"),
  (module) => module.CrmUiMessagesProvider,
)
const quotesMessagesProvider = loadProvider(
  () => import("@voyant-travel/quotes-react/i18n"),
  (module) => module.CrmUiMessagesProvider,
)

const bookingRouteMessagesProvider = composeProviderLoaders(
  bookingsMessagesProvider,
  financeMessagesProvider,
  crmMessagesProvider,
  productsMessagesProvider,
  catalogMessagesProvider,
)
const distributionRouteMessagesProvider = composeProviderLoaders(
  distributionMessagesProvider,
  suppliersMessagesProvider,
)
const operationsRouteMessagesProvider = composeProviderLoaders(
  availabilityMessagesProvider,
  allocationMessagesProvider,
  resourcesMessagesProvider,
)
const relationshipsRouteMessagesProvider = composeProviderLoaders(
  crmMessagesProvider,
  bookingsMessagesProvider,
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
  commerce: commerceMessagesProvider,
  distribution: distributionRouteMessagesProvider,
  finance: financeMessagesProvider,
  flights: flightsMessagesProvider,
  inventory: productsMessagesProvider,
  legal: legalMessagesProvider,
  notifications: notificationsMessagesProvider,
  operations: operationsRouteMessagesProvider,
  quotes: quotesMessagesProvider,
  relationships: relationshipsRouteMessagesProvider,
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

function withManagedRouteMessagesProviders(
  extensions: ReadonlyArray<AdminExtension>,
): ReadonlyArray<AdminExtension> {
  return extensions.map((extension) =>
    withRouteMessagesProvider(extension, extensionRouteMessagesProviders[extension.id]),
  )
}

/**
 * The full source-free admin registry. Every domain factory is called with
 * default (English) labels; only the operator's non-label options that affect
 * routing/ordering are preserved (catalog deployment scope, commerce/action
 * ledger order).
 */
export function createManagedAdminExtensions(): AdminExtension[] {
  return [
    ...withManagedRouteMessagesProviders(
      createAdminExtensionRegistry(
        // The Operator Profile settings page is the one GENERAL settings item
        // that is not a built-in core page — it edits the operator's
        // contract identity via `@voyant-travel/operator-settings`'s
        // `/v1/admin/settings/operator-*` routes (already mounted on the
        // managed runtime). Mount the packaged, source-free page as an extra
        // settings page so the managed admin matches the operator starter.
        createAdminCoreExtension({
          settings: { extraPages: [createOperatorProfileSettingsExtraPage()] },
        }),
        createOperationsAdminExtension(),
        createBookingsAdminExtension(),
        createCatalogAdminExtension({
          defaultLocale: "en-GB",
          defaultMarket: "default",
          scopeStrategy: "deployment-default",
          hideScopeControls: true,
        }),
        createInventoryAdminExtension(),
        createRelationshipsAdminExtension(),
        createDistributionAdminExtension(),
        createFinanceAdminExtension(),
        createFlightsAdminExtension(),
        createLegalAdminExtension(),
        createNotificationsAdminExtension(),
        createCommerceAdminExtension({ order: 50 }),
        createTripsAdminExtension(),
        createQuotesAdminExtension(),
        createMiceAdminExtension(),
        createActionLedgerAdminExtension({ order: 60 }),
      ),
    ),
  ]
}
