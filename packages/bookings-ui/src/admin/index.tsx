import {
  type AdminExtension,
  type AdminWidgetContribution,
  defineAdminExtension,
} from "@voyantjs/admin"
import type { BookingsListSortDir, BookingsListSortField } from "@voyantjs/bookings-react"
// Importing the slot id also binds the crm-ui `AdminDestinations`
// augmentation (`person.list`, `organization.list`, ...) into this program;
// this package already peer-depends on `@voyantjs/crm-ui`.
import { personDetailBookingsTabSlot } from "@voyantjs/crm-ui/admin"
import type { ComponentType } from "react"
import { z } from "zod"
import type { BookingDetailTabValue } from "../components/booking-detail-page.js"
import type { BookingListFiltersState } from "../components/booking-list.js"
import { PersonBookingsWidget } from "./person-bookings-widget.js"

/**
 * Semantic destinations the bookings admin surfaces navigate to
 * (packaged-admin RFC §4.7). The booking pages link into routes they do not
 * own — the CRM person/organization pages, the product editor, the finance
 * payment/invoice pages — so instead of importing a host route tree they
 * resolve these keys through `useAdminHref`/`useAdminNavigate` from
 * `@voyantjs/admin`. Hosts register one resolver per key
 * (`satisfies AdminDestinationResolvers`).
 *
 * `booking.detail`/`booking.list`/`booking.create` are declared here even
 * though bookings pages are their first consumers: other domains' packaged
 * pages navigate TO bookings through the same keys.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The bookings list page. */
    "booking.list": Record<string, never>
    /** A booking's detail page; `tab` deep-links a specific tab. */
    "booking.detail": { bookingId: string; tab?: BookingDetailTabValue }
    /** The "New booking" entry point (product picker → unified journey). */
    "booking.create": Record<string, never>
    /** A CRM person's detail page. */
    "person.detail": { personId: string }
    /** A CRM organization's detail page. */
    "organization.detail": { organizationId: string }
    /**
     * The owned-product editor/detail page. Also declared by
     * `@voyantjs/catalog-ui/admin` — interface merging requires the member
     * shape to stay identical across packages.
     */
    "product.detail": { productId: string }
    /** An availability slot's detail page. */
    "availabilitySlot.detail": { slotId: string }
    /** A payment's detail page in the finance area. */
    "payment.detail": { paymentId: string }
    /** An invoice's full detail page in the finance area. */
    "invoice.detail": { invoiceId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the bookings pages
// bound to their data wiring + semantic-destination navigation. Host route
// files only bind route params/search state onto these.
export {
  BookingDetailHost,
  type BookingDetailHostProps,
  type BookingDetailHostSlot,
  type BookingDetailHostSlotContext,
  type BookingDetailHostSlots,
  bookingDetailInvoicesTabSlot,
} from "./booking-detail-host.js"
export { BookingDetailSkeleton } from "./booking-detail-skeleton.js"
export {
  BookingInvoiceSheet,
  type BookingInvoiceSheetProps,
} from "./booking-invoice-sheet.js"
export { BookingsHost, type BookingsHostProps } from "./bookings-host.js"
export { BookingsListSkeleton } from "./bookings-list-skeleton.js"
export {
  PersonBookingsWidget,
  type PersonBookingsWidgetProps,
} from "./person-bookings-widget.js"

const bookingsListSortBySchema = z.enum([
  "bookingNumber",
  "status",
  "sellAmount",
  "pax",
  "startDate",
  "endDate",
  "createdAt",
]) satisfies z.ZodType<BookingsListSortField>
const bookingsListSortDirSchema = z.enum(["asc", "desc"]) satisfies z.ZodType<BookingsListSortDir>

/**
 * Search contract for the bookings list page: the URL projection of
 * `BookingListFiltersState` (filters, sort, paging). Package-owned so the
 * route file, the host, and the extension contribution validate the same
 * shape. Defaults are absent from the URL — see
 * {@link bookingsFiltersToSearch}.
 */
export const bookingsIndexSearchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  supplierId: z.string().optional(),
  productCategoryId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  availabilitySlotId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  paxMin: z.string().optional(),
  paxMax: z.string().optional(),
  sortBy: bookingsListSortBySchema.optional(),
  sortDir: bookingsListSortDirSchema.optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export type BookingsIndexSearchParams = z.infer<typeof bookingsIndexSearchSchema>

/** URL search params → `BookingList` initial state. Empty / `"all"` /
 * default values are absent in the URL; we let `BookingList`'s defaults
 * fill them in. */
export function bookingsSearchToFilters(
  search: BookingsIndexSearchParams,
): Partial<BookingListFiltersState> {
  return {
    search: search.search,
    status: search.status,
    productId: search.productId ?? null,
    optionId: search.optionId ?? null,
    supplierId: search.supplierId ?? null,
    productCategoryId: search.productCategoryId ?? null,
    personId: search.personId ?? null,
    organizationId: search.organizationId ?? null,
    availabilitySlotId: search.availabilitySlotId ?? null,
    dateFrom: search.dateFrom ?? null,
    dateTo: search.dateTo ?? null,
    paxMin: search.paxMin,
    paxMax: search.paxMax,
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    offset: search.offset,
  }
}

/** Project the filter snapshot back into URL search params, dropping
 * any value that matches the component's default so the URL stays
 * clean when the operator is viewing the unfiltered list. */
export function bookingsFiltersToSearch(
  filters: BookingListFiltersState,
): BookingsIndexSearchParams {
  return {
    search: filters.search || undefined,
    status: filters.status === "all" ? undefined : filters.status,
    productId: filters.productId ?? undefined,
    optionId: filters.optionId ?? undefined,
    supplierId: filters.supplierId ?? undefined,
    productCategoryId: filters.productCategoryId ?? undefined,
    personId: filters.personId ?? undefined,
    organizationId: filters.organizationId ?? undefined,
    availabilitySlotId: filters.availabilitySlotId ?? undefined,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    paxMin: filters.paxMin || undefined,
    paxMax: filters.paxMax || undefined,
    sortBy: filters.sortBy === "createdAt" ? undefined : filters.sortBy,
    sortDir: filters.sortDir === "desc" ? undefined : filters.sortDir,
    offset: filters.offset === 0 ? undefined : filters.offset,
  }
}

/** Tab values of the canonical `BookingDetailPage`, as a search-param schema. */
export const bookingDetailTabSchema = z.enum([
  "items",
  "travelers",
  "finance",
  "invoices",
  "documents",
  "suppliers",
  "activity",
  "metadata",
]) satisfies z.ZodType<BookingDetailTabValue>

/**
 * Search contract for the booking detail page. `productId`/`slotId` only
 * matter for the `"new"` pseudo-id: a deep link with a product pre-chosen
 * redirects into the unified booking journey (host route concern).
 */
export const bookingDetailSearchSchema = z.object({
  productId: z.string().optional(),
  slotId: z.string().optional(),
  tab: bookingDetailTabSchema.optional(),
})

export type BookingDetailSearchParams = z.infer<typeof bookingDetailSearchSchema>

export interface CreateBookingsAdminExtensionOptions {
  /** Mount path of the bookings pages inside the admin workspace. Default `/bookings`. */
  basePath?: string
  /** Localized page title. Default is the English operator nav label. */
  label?: string
}

/**
 * The bookings admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Bookings nav item is part of the BASE
 * operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing nav entries here would duplicate it.
 * If the base nav ever drops the bookings item, this extension is where the
 * entry moves.
 *
 * ROUTES: contributions are metadata + the package-owned search contracts
 * ({@link bookingsIndexSearchSchema} for the list,
 * {@link bookingDetailSearchSchema} for the detail page). The PAGES are
 * package-owned too: {@link BookingsHost} and {@link BookingDetailHost}
 * bind the canonical bookings pages to their data wiring (bookings/finance
 * provider context) and resolve every cross-route link through the semantic
 * destinations declared above — no app RPC client, no host route tree.
 *
 * `component:` is intentionally NOT attached to these contributions yet:
 * the contribution contract renders zero-prop pages (route components read
 * params via the router, per RFC §4.2), while both bookings hosts take
 * route params/search state as props. Host route files stay the thin
 * binding layer (`Route.useParams()`/`Route.useSearch()` → host props)
 * until the §4.2 code-based route assembly gives packaged pages a
 * router-agnostic way to read route state.
 *
 * WIDGETS: the crm-ui ↔ bookings-ui cycle resolution (RFC §4.7). The CRM
 * person detail page mounts a Bookings tab, but this package depends on
 * `@voyantjs/crm-ui`, so crm-ui's host cannot import the bookings-owned
 * card. Instead this extension contributes {@link PersonBookingsWidget} on
 * the `person.details.bookings-tab` slot crm-ui's `PersonDetailHost`
 * exposes; the host mounts its Bookings tab whenever a contribution targets
 * that slot and hands the widget its typed slot context
 * (`PersonDetailBookingsTabContext`) as props.
 */
export function createBookingsAdminExtension(
  options: CreateBookingsAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/bookings", label = "Bookings" } = options

  return defineAdminExtension({
    id: "bookings",
    routes: [
      {
        id: "bookings-index",
        path: basePath,
        title: label,
        validateSearch: (search) => bookingsIndexSearchSchema.parse(search),
      },
      {
        id: "bookings-detail",
        path: `${basePath}/$id`,
        title: label,
        validateSearch: (search) => bookingDetailSearchSchema.parse(search),
      },
    ],
    widgets: [
      {
        id: "bookings-person-bookings",
        slot: personDetailBookingsTabSlot,
        // The widget registry is untyped (`Record<string, unknown>` props);
        // the typed contract is `PersonDetailBookingsTabContext`, which
        // crm-ui's person detail host passes verbatim to this slot's widgets.
        component: PersonBookingsWidget as unknown as ComponentType<Record<string, unknown>>,
      } satisfies AdminWidgetContribution,
    ],
  })
}
