import { useNavigate } from "@tanstack/react-router"
import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  adminRoutePageModule,
  createAdminExtensionRegistry,
} from "@voyant-travel/admin"
import { createAdminCoreExtension } from "@voyant-travel/admin-app/core-extension"
import { Button } from "@voyant-travel/ui/components/button"
import { Building, Route, ScrollText, Tag } from "lucide-react"
import { generatedAdminExtensionFactories } from "@/admin.extensions.generated"
import type { AdminMessages } from "@/lib/admin-i18n"

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
  | "resources"
  | "supplierInvoices"
  | "suppliers"
  | "trips"
>

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
// - the Operator Profile settings page: an app-custom page (it talks to the
//   operator starter's `/v1/admin/settings/operator-*` endpoints, which
//   have no packaged client yet) spliced into the packaged settings layout
//   as an extra page, leading the General group.
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
      extraPages: [
        {
          id: "operator",
          path: "/operator",
          title: "Operator Profile",
          label: (messages) => messages.settings.operator,
          icon: Building,
          group: "general",
          order: 10,
          page: () =>
            import("@/components/voyant/settings/operator-settings-page").then((module) =>
              adminRoutePageModule(module.OperatorSettingsPage),
            ),
        },
      ],
    },
  })
}

// Operations is package-delivered (packaged-admin RFC Phase 3): the owner
// extension contributes NO navigation — Availability and Resources remain
// base operator navigation items. The owner admin entry contributes the
// availability and resource-planning route metadata under
// /operations/availability and /operations/resources.
function createOperationsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.operations({
    labels: {
      availability: messages.availability,
      resources: messages.resources,
    },
  })
}

// App-owned header action on the package-delivered bookings list: composing
// a trip is an operator concept (the trips pages are app-custom),
// so the button rides in through the extension factory's
// `indexHeaderActions` option instead of a host route file.
function ComposeTripButton() {
  const navigate = useNavigate()

  return (
    <Button
      variant="outline"
      onClick={() => void navigate({ to: "/trips/$id", params: { id: "new" } })}
    >
      <Route className="size-4" aria-hidden="true" />
      Compose trip
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
    labels: {
      products: messages.catalogProducts,
      excursions: messages.catalogExcursions,
      tours: messages.catalogTours,
      cruises: messages.catalogCruises,
      accommodations: messages.catalogAccommodations,
    },
  })
}

// Finance is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Finance group is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyant-travel/admin), so entries
// here would duplicate it. It's registered for the routes seam (metadata for
// the finance pages; the detail pages are the packaged hosts from
// @voyant-travel/finance-react/admin) AND for the widgets seam: it contributes the
// finance-owned booking invoices card on booking UI's
// `booking.details.invoices-tab` slot — the finance-ui ↔ booking UI cycle
// resolution (finance-ui depends on booking UI, so the bookings host can't
// import the card; the widget contribution travels the other way).
function createFinanceExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.finance({
    labels: {
      invoices: messages.invoices,
      invoiceNumberSeries: messages.invoiceNumberSeries,
      payments: messages.payments,
      supplierInvoices: messages.supplierInvoices,
      profitability: messages.profitability,
    },
  })
}

// Flights is package-delivered (packaged-admin RFC Phase 3 + §4.8): the
// extension contributes NO navigation — the Flights item is part of the BASE
// operator navigation (createOperatorAdminNavigation in @voyant-travel/admin), so
// an entry here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route implementations + search
// contracts (flightsIndexSearchSchema / flightsBookSearchSchema), and the
// host assembles them into its code-based route tree — no route files. The
// booking wizard mounts as a flat sibling of the search page (the old
// file-based tree's `flights_.book` escape), and its hand-written
// `flightBooking.start` resolver lives in src/lib/admin-destinations.ts.
function createFlightsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.flights({ labels: { flights: messages.flights } })
}

// Distribution is package-delivered (packaged-admin RFC Phase 3 + §4.8): the
// extension contributes NO navigation — the Channel sync item is part of the
// BASE operator navigation (createOperatorAdminNavigation in
// @voyant-travel/admin), so an entry here would duplicate it. It's registered for
// the routes seam: the contribution carries the package-owned channel-sync
// page (no search contract — the page keeps its filters local), and the host
// assembles it into its code-based route tree — no route file.
function createDistributionExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.distribution({
    labels: { channelSync: messages.channelSync, suppliers: messages.suppliers },
  })
}

// Relationships is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the People and Organizations items are part of
// the BASE operator navigation (createOperatorAdminNavigation in
// @voyant-travel/admin), so entries here would duplicate them. It's registered
// for the routes seam (metadata for the people/organization pages; the pages
// are the packaged hosts from @voyant-travel/relationships-react/admin — the route files under
// src/routes/_workspace/people/* and src/routes/_workspace/organizations/*
// only bind route params onto them). The person detail page's Bookings tab
// is the relationships-ui ↔ booking UI cycle resolution: booking UI contributes its
// PersonBookingsWidget on relationships-ui's `person.details.bookings-tab` slot.
function createRelationshipsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.relationships({
    labels: {
      people: messages.people,
      organizations: messages.organizations,
    },
  })
}

// Legal is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Legal group is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyant-travel/admin), so entries
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata (the legal pages keep
// their filter state component-local, so there are no URL search contracts),
// and the pages are the packaged hosts from @voyant-travel/legal-react/admin — the
// route files under src/routes/_workspace/legal/* only bind route params
// onto them.
function createLegalExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.legal({
    labels: {
      contracts: messages.contracts,
      contractTemplates: messages.contractTemplates,
      policies: messages.policies,
      numberSeries: messages.contractNumberSeries,
    },
  })
}

// Notifications is package-delivered (packaged-admin RFC Phase 3): the
// extension contributes NO navigation — the Notifications group is part of
// the BASE operator navigation (createOperatorAdminNavigation in
// @voyant-travel/admin), so entries here would duplicate it. It's registered for
// the routes seam: the contributions carry the package-owned route metadata
// (the notifications pages keep their filter state component-local, so
// there are no URL search contracts), and the pages are the packaged hosts
// from @voyant-travel/notifications-react/admin — the route files under
// src/routes/_workspace/notifications/* only bind route params onto them.
function createNotificationsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.notifications({
    labels: {
      templates: messages.notificationTemplates,
      reminderRules: messages.notificationReminderRules,
      deliveries: messages.notificationDeliveries,
      reminderRuns: messages.notificationReminderRuns,
      preview: messages.notificationPreview,
      settings: messages.notificationSettings,
    },
  })
}

// Suppliers is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Suppliers item is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyant-travel/admin), so an entry
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata (no search contracts —
// the list keeps its filters local), and the pages are the packaged hosts
// from @voyant-travel/distribution-react/suppliers/admin — the route files under
// src/routes/_workspace/suppliers/* only bind route params onto them. The
// detail page's customer-payment-policy card arrives via finance-ui's widget
// contribution on `supplier.details.payment-policy` (the finance-ui ↔
// suppliers-ui cycle resolution).
// Promotions is package-delivered (packaged-admin RFC Phase 2): nav AND the
// route implementation come from @voyant-travel/commerce-react/promotions/admin. The app only
// supplies the localized label and icon. Order 50 nudges it past the default
// admin items so it lands alongside the operator's commercial tools.
function createPromotionsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.commerce({
    labels: { promotions: messages.promotions },
    icon: Tag,
    order: 50,
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
// app's /api/v1/uploads storage route, and the product-pre-selected
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

// Trips is package-delivered (packaged-admin RFC Phase 2): nav AND
// the route implementations come from @voyant-travel/trips-react/admin —
// the Trips group (spliced after Bookings via `insertAfter`, with All trips /
// New trip sub-items), the trips list, and the detail page whose Edit mode
// lazy-mounts the packaged trips. The app only supplies the localized
// labels and the icon.
function createTripsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.trips({
    labels: {
      trips: messages.trips,
      allTrips: messages.allTrips,
      newTrip: messages.newTrip,
    },
    icon: Route,
  })
}

// Action ledger is package-delivered (packaged-admin RFC Phase 2): nav AND
// the route implementation come from @voyant-travel/action-ledger-react/admin —
// the Logs nav item (order 60, past the default admin items) and the
// cursor-paginated Logs page. The app only supplies the localized label and
// the icon.
function createActionLedgerExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.actionLedger({
    labels: { actionLedger: messages.actionLedger },
    icon: ScrollText,
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
  channelSync: "Channel sync",
  categories: "Categories",
  contractNumberSeries: "Number Series",
  contractTemplates: "Contract Templates",
  contracts: "Contracts",
  flights: "Flights",
  invoiceNumberSeries: "Number Series",
  invoices: "Invoices",
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
  resources: "Resources",
  supplierInvoices: "Supplier invoices",
  suppliers: "Suppliers",
  trips: "Trips",
}

export function createOperatorAdminExtensions(
  messages: AdminExtensionNavMessages,
): ReadonlyArray<AdminExtension> {
  return createAdminExtensionRegistry(
    createCoreExtension(),
    createOperationsExtension(messages),
    createBookingsExtension(messages),
    createCatalogExtension(messages),
    createProductsExtension(messages),
    createRelationshipsExtension(messages),
    createDistributionExtension(messages),
    createFinanceExtension(messages),
    createFlightsExtension(messages),
    createLegalExtension(messages),
    createNotificationsExtension(messages),
    createPromotionsExtension(messages),
    createTripsExtension(messages),
    createActionLedgerExtension(messages),
  )
}

export const adminExtensions: ReadonlyArray<AdminExtension> = createOperatorAdminExtensions(
  defaultExtensionNavMessages,
)
