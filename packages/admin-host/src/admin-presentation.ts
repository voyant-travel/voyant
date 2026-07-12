import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminSettingsPageContribution,
  adminExtensionsFromGlob,
  createAdminExtensionRegistry,
} from "@voyant-travel/admin"
import {
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
} from "@voyant-travel/admin/dashboard/query-options"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"

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

export interface CreateAdminHostPresentationOptions {
  accessCatalog: AccessCatalog
  selected: SelectedExtensionsFactory
  project?: Record<string, unknown>
}

export interface AdminHostPresentation {
  extensions: ReadonlyArray<AdminExtension>
  createExtensions: (navMessages: Readonly<Record<string, string>>) => ReadonlyArray<AdminExtension>
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

  return createAdminExtensionRegistry(core(settingsPages), ...selectedExtensions, ...discovered)
}

/** Build the standard selected-graph presentation with optional project-local extensions. */
export function createAdminHostPresentation({
  accessCatalog,
  selected,
  project = {},
}: CreateAdminHostPresentationOptions): AdminHostPresentation {
  const discovered = discoverAdminHostExtensions(project)
  const createExtensions = (navMessages: Readonly<Record<string, string>>) =>
    createAdminHostExtensions({
      core: (settingsPages) =>
        createAdminCoreExtension({
          dashboard: { loader: loadAdminDashboard },
          settings: { accessCatalog, extraPages: settingsPages },
        }),
      selected,
      navMessages,
      discovered,
    })

  return {
    createExtensions,
    extensions: createExtensions(defaultAdminHostNavMessages),
  }
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
