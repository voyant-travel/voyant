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
  | "bookings"
  | "catalogAccommodations"
  | "catalogCruises"
  | "catalogExcursions"
  | "catalogProducts"
  | "catalogTours"
  | "invoiceNumberSeries"
  | "invoices"
  | "newTrip"
  | "organizations"
  | "payments"
  | "people"
  | "profitability"
  | "promotions"
  | "supplierInvoices"
  | "trips"
>

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
  bookings: "Bookings",
  catalogAccommodations: "Accommodations",
  catalogCruises: "Cruises",
  catalogExcursions: "Excursions",
  catalogProducts: "Packages",
  catalogTours: "Tours",
  invoiceNumberSeries: "Number Series",
  invoices: "Invoices",
  newTrip: "New trip",
  organizations: "Organizations",
  payments: "Payments",
  people: "People",
  profitability: "Profitability",
  promotions: "Promotions",
  supplierInvoices: "Supplier invoices",
  trips: "Trips",
}

export function createOperatorAdminExtensions(
  messages: AdminExtensionNavMessages,
): ReadonlyArray<AdminExtension> {
  return createAdminExtensionRegistry(
    createBookingsExtension(messages),
    createCatalogExtension(messages),
    createCrmExtension(messages),
    createFinanceExtension(messages),
    createPromotionsExtension(messages),
    createTravelComposerExtension(messages),
    createActionLedgerExtension(messages),
  )
}

export const adminExtensions: ReadonlyArray<AdminExtension> = createOperatorAdminExtensions(
  defaultExtensionNavMessages,
)
