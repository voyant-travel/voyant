import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteMessagesProvider,
  type AdminRouteMessagesProviderLoader,
  type AdminSettingsPageContribution,
  type AdminUiRouteContribution,
  adminExtensionsFromGlob,
  createAdminExtensionRegistry,
} from "@voyant-travel/admin"
import {
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
} from "@voyant-travel/admin/dashboard/query-options"

type SelectedExtensionsFactory = (context: {
  navMessages: Readonly<Record<string, string>>
}) => ReadonlyArray<AdminExtension>

type CoreExtensionFactory = (
  settingsPages: ReadonlyArray<AdminSettingsPageContribution>,
) => AdminExtension

export interface CreateAdminHostExtensionsOptions {
  core: CoreExtensionFactory
  selected: SelectedExtensionsFactory
  navMessages: Readonly<Record<string, string>>
  discovered?: ReadonlyArray<AdminExtension>
}

function loadProvider<TModule>(
  importer: () => Promise<TModule>,
  pick: (module: TModule) => AdminRouteMessagesProvider,
): AdminRouteMessagesProviderLoader {
  return () => importer().then((module) => ({ default: pick(module) }))
}

const coreRouteMessagesProviders: Readonly<
  Record<string, AdminRouteMessagesProviderLoader | undefined>
> = {
  "core-account": loadProvider(
    () => import("@voyant-travel/auth-react/i18n"),
    (module) => module.AuthUiMessagesProvider,
  ),
  "core-settings-api-tokens": loadProvider(
    () => import("@voyant-travel/auth-react/i18n"),
    (module) => module.AuthUiMessagesProvider,
  ),
  "core-settings-channels": loadProvider(
    () => import("@voyant-travel/distribution-react/i18n"),
    (module) => module.DistributionUiMessagesProvider,
  ),
  "core-settings-custom-fields": loadProvider(
    () => import("@voyant-travel/relationships-react/i18n"),
    (module) => module.CrmUiMessagesProvider,
  ),
  "core-settings-taxes": loadProvider(
    () => import("@voyant-travel/finance-react/i18n"),
    (module) => module.FinanceUiMessagesProvider,
  ),
  "core-settings-cost-categories": loadProvider(
    () => import("@voyant-travel/finance-react/i18n"),
    (module) => module.FinanceUiMessagesProvider,
  ),
  "core-settings-pricing-categories": loadProvider(
    () => import("@voyant-travel/commerce-react/i18n"),
    (module) => module.CommerceUiMessagesProvider,
  ),
  "core-settings-price-catalogs": loadProvider(
    () => import("@voyant-travel/commerce-react/i18n"),
    (module) => module.CommerceUiMessagesProvider,
  ),
  "core-settings-product-types": loadProvider(
    () => import("@voyant-travel/inventory-react/i18n"),
    (module) => module.ProductsUiMessagesProvider,
  ),
  "core-settings-product-tags": loadProvider(
    () => import("@voyant-travel/inventory-react/i18n"),
    (module) => module.ProductsUiMessagesProvider,
  ),
}

function withCoreRouteMessages(extension: AdminExtension): AdminExtension {
  if (extension.id !== "core" || !extension.routes) return extension

  const apply = (route: AdminUiRouteContribution): AdminUiRouteContribution => {
    const provider = route.redirectTo ? undefined : coreRouteMessagesProviders[route.id]
    return {
      ...route,
      routeMessagesProvider: route.routeMessagesProvider ?? provider,
      children: route.children?.map(apply),
    }
  }

  return { ...extension, routes: extension.routes.map(apply) }
}

export function discoverAdminHostExtensions(glob: Record<string, unknown>): AdminExtension[] {
  return adminExtensionsFromGlob(glob)
}

/** Compose core, generated selected-graph, and project-local admin extensions. */
export function createAdminHostExtensions({
  core,
  selected,
  navMessages,
  discovered = [],
}: CreateAdminHostExtensionsOptions): ReadonlyArray<AdminExtension> {
  const selectedExtensions = selected({ navMessages })
  const settingsPages = selectedExtensions.flatMap((extension) => extension.settingsPages ?? [])

  return createAdminExtensionRegistry(
    withCoreRouteMessages(core(settingsPages)),
    ...selectedExtensions,
    ...discovered,
  )
}

/** Prefetch the standard dashboard through the host's authenticated API runtime. */
export async function loadAdminDashboard({
  queryClient,
  runtime,
}: AdminRouteLoaderContext): Promise<void> {
  const client = {
    baseUrl: runtime.baseUrl,
    fetcher:
      runtime.fetcher ??
      ((url: string, init?: RequestInit) => fetch(url, { credentials: "include", ...init })),
  }
  await Promise.all([
    queryClient.ensureQueryData(getDashboardBookingsAggregatesQueryOptions(client)),
    queryClient.ensureQueryData(getDashboardProductsAggregatesQueryOptions(client)),
    queryClient.ensureQueryData(getDashboardSuppliersAggregatesQueryOptions(client)),
    queryClient.ensureQueryData(getDashboardFinanceAggregatesQueryOptions(client)),
  ])
}

export const defaultAdminHostNavMessages = {
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
} as const
