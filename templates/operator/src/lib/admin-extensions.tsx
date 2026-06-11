import {
  type AdminExtension,
  createAdminExtensionRegistry,
  defineAdminExtension,
} from "@voyantjs/admin"
import { Route, ScrollText, Tag } from "lucide-react"
import { generatedAdminExtensionFactories } from "@/admin.extensions.generated"
import type { AdminMessages } from "@/lib/admin-i18n"

/**
 * Operator admin contributions composed through the shared admin runtime.
 *
 * Keep this explicit and source-controlled so the template still owns shell
 * composition while the extension seam stays typed and framework-level.
 *
 * Widget slots currently exposed by the operator template:
 * - `dashboard.header`
 * - `dashboard.after-kpis`
 * - `dashboard.footer`
 * - `booking.details.header`
 * - `booking.details.after-summary`
 * - `booking.details.invoices-tab` (packaged: rendered by bookings-ui's
 *   `BookingDetailHost`; finance-ui contributes its invoices card here —
 *   the finance-ui ↔ bookings-ui cycle resolution)
 * - `person.details.bookings-tab` (packaged: rendered by crm-ui's
 *   `PersonDetailHost`; bookings-ui contributes its person-bookings card
 *   here — the crm-ui ↔ bookings-ui cycle resolution)
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
  | "contractNumberSeries"
  | "contractTemplates"
  | "contracts"
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
  | "profitability"
  | "promotions"
  | "resources"
  | "supplierInvoices"
  | "suppliers"
  | "trips"
>

// Availability is package-delivered (packaged-admin RFC Phase 3): the
// extension contributes NO navigation — the Availability item is part of the
// BASE operator navigation (createOperatorAdminNavigation in @voyantjs/admin),
// so an entry here would duplicate it. It's registered for the routes seam:
// the contributions carry the package-owned route metadata (no search
// contracts — the pages keep their filters local), and the detail pages are
// the packaged hosts from @voyantjs/availability-ui/admin — the route files
// under src/routes/_workspace/availability/* only bind route params onto
// them. The index page stays an app-side wrapper: its bulk update/delete
// handlers call the availability batch endpoints, which have no
// availability-react client equivalent yet.
function createAvailabilityExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.availability({ label: messages.availability })
}

// Bookings is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Bookings item is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so an entry
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata + search contracts
// (bookingsIndexSearchSchema / bookingDetailSearchSchema), and the pages are
// the packaged hosts from @voyantjs/bookings-ui/admin — the route files under
// src/routes/_workspace/bookings/* only bind route params/search onto them.
function createBookingsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.bookings({ label: messages.bookings })
}

// Catalog is package-delivered (packaged-admin RFC Phase 2): the extension
// contributes NO navigation — the Catalog group is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so entries
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata + search contracts
// (catalogSearchSchema / productDetailSearchSchema), and the pages are the
// packaged hosts from @voyantjs/catalog-ui/admin — the route files under
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
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so entries
// here would duplicate it. It's registered for the routes seam (metadata for
// the finance pages; the detail pages are the packaged hosts from
// @voyantjs/finance-ui/admin) AND for the widgets seam: it contributes the
// finance-owned booking invoices card on bookings-ui's
// `booking.details.invoices-tab` slot — the finance-ui ↔ bookings-ui cycle
// resolution (finance-ui depends on bookings-ui, so the bookings host can't
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

// CRM is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the People and Organizations items are part of
// the BASE operator navigation (createOperatorAdminNavigation in
// @voyantjs/admin), so entries here would duplicate them. It's registered
// for the routes seam (metadata for the people/organization pages; the pages
// are the packaged hosts from @voyantjs/crm-ui/admin — the route files under
// src/routes/_workspace/people/* and src/routes/_workspace/organizations/*
// only bind route params onto them). The person detail page's Bookings tab
// is the crm-ui ↔ bookings-ui cycle resolution: bookings-ui contributes its
// PersonBookingsWidget on crm-ui's `person.details.bookings-tab` slot.
function createCrmExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.crm({
    labels: {
      people: messages.people,
      organizations: messages.organizations,
    },
  })
}

// Legal is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Legal group is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so entries
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata (the legal pages keep
// their filter state component-local, so there are no URL search contracts),
// and the pages are the packaged hosts from @voyantjs/legal-ui/admin — the
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
// @voyantjs/admin), so entries here would duplicate it. It's registered for
// the routes seam: the contributions carry the package-owned route metadata
// (the notifications pages keep their filter state component-local, so
// there are no URL search contracts), and the pages are the packaged hosts
// from @voyantjs/notifications-ui/admin — the route files under
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
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so an entry
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata (no search contracts —
// the list keeps its filters local), and the pages are the packaged hosts
// from @voyantjs/suppliers-ui/admin — the route files under
// src/routes/_workspace/suppliers/* only bind route params onto them. The
// detail page's customer-payment-policy card arrives via finance-ui's widget
// contribution on `supplier.details.payment-policy` (the finance-ui ↔
// suppliers-ui cycle resolution).
function createSuppliersExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.suppliers({ label: messages.suppliers })
}

// Resources is package-delivered (packaged-admin RFC Phase 3): the extension
// contributes NO navigation — the Resources item is part of the BASE operator
// navigation (createOperatorAdminNavigation in @voyantjs/admin), so an entry
// here would duplicate it. It's registered for the routes seam: the
// contributions carry the package-owned route metadata (no search contracts —
// the tab dashboard keeps its tab/filter state local), and the pages are the
// packaged hosts from @voyantjs/resources-ui/admin — the route files under
// src/routes/_workspace/resources/* only bind route params onto them.
function createResourcesExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.resources({ label: messages.resources })
}

// Promotions is package-delivered (packaged-admin RFC Phase 2): nav AND the
// route implementation come from @voyantjs/promotions-ui/admin. The app only
// supplies the localized label and icon. Order 50 nudges it past the default
// admin items so it lands alongside the operator's commercial tools.
function createPromotionsExtension(messages: AdminExtensionNavMessages) {
  return generatedAdminExtensionFactories.promotions({
    label: messages.promotions,
    icon: Tag,
    order: 50,
  })
}

function createTravelComposerExtension(messages: AdminExtensionNavMessages) {
  return defineAdminExtension({
    id: "travel-composer",
    navigation: [
      {
        // Splice Trips in right after Bookings — both belong to the booking
        // lifecycle. `insertAfter` keeps the contribution shape; the resolver
        // splices in place rather than appending at the end.
        insertAfter: "bookings",
        items: [
          {
            id: "travel-composer",
            title: messages.trips,
            url: "/trips",
            icon: Route,
            items: [
              {
                id: "travel-composer-list",
                title: messages.allTrips,
                url: "/trips",
              },
              {
                id: "travel-composer-new",
                title: messages.newTrip,
                url: "/trips/new",
              },
            ],
          },
        ],
      },
    ],
  })
}

function createActionLedgerExtension(messages: AdminExtensionNavMessages) {
  return defineAdminExtension({
    id: "action-ledger",
    navigation: [
      {
        order: 60,
        items: [
          {
            id: "action-ledger",
            title: messages.actionLedger,
            url: "/action-ledger",
            icon: ScrollText,
          },
        ],
      },
    ],
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
  contractNumberSeries: "Number Series",
  contractTemplates: "Contract Templates",
  contracts: "Contracts",
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
    createAvailabilityExtension(messages),
    createBookingsExtension(messages),
    createCatalogExtension(messages),
    createCrmExtension(messages),
    createFinanceExtension(messages),
    createSuppliersExtension(messages),
    createLegalExtension(messages),
    createResourcesExtension(messages),
    createNotificationsExtension(messages),
    createPromotionsExtension(messages),
    createTravelComposerExtension(messages),
    createActionLedgerExtension(messages),
  )
}

export const adminExtensions: ReadonlyArray<AdminExtension> = createOperatorAdminExtensions(
  defaultExtensionNavMessages,
)
