/**
 * Turning id-shaped domain events into the data a staff alert email shows.
 *
 * Every resolver here calls the OWNING module's service — never its tables.
 * That is the distinction `verify:table-privacy` enforces: a service call is
 * in-process coupling, which ADR-0016 permits between modules; a table read
 * would open an importer->owner pair, and several of these pairs
 * (`notifications->relationships`, `notifications->operator-settings`) do not
 * exist and may not be created.
 *
 * A resolver returns `null` for "nothing to send" — the record was deleted
 * between publish and delivery, or the payload names something the alert does
 * not apply to. That is a normal outcome; only genuine failures throw.
 */

import { bookingsService } from "@voyant-travel/bookings"
import { getOperatorProfile } from "@voyant-travel/operator-settings/service"
import { relationshipsService } from "@voyant-travel/relationships"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  DEFAULT_STAFF_ALERT_BRAND_COLOR,
  DEFAULT_STAFF_ALERT_CORNER_RADIUS,
  normalizeBrandColor,
  type StaffAlertBrand,
} from "./emails/brand.js"
import type {
  StaffAlertContextResolver,
  StaffAlertContextResolverRegistry,
  StaffAlertParty,
} from "./staff-alert-registry.js"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** A booking row's customer, as far as bookings itself records one. */
function partyFromBooking(booking: Record<string, unknown>): StaffAlertParty | null {
  const name =
    asString(booking.customerName) ??
    [asString(booking.customerFirstName), asString(booking.customerLastName)]
      .filter(Boolean)
      .join(" ")
  if (!name) return null
  return { name, email: asString(booking.customerEmail) }
}

function moneyFromBooking(booking: Record<string, unknown>) {
  const amountCents = asNumber(booking.totalCents) ?? asNumber(booking.totalAmountCents)
  const currency = asString(booking.currency)
  if (amountCents === null || !currency) return null
  return { amountCents, currency }
}

async function loadBooking(db: PostgresJsDatabase, bookingId: string) {
  const booking = await bookingsService.getBookingById(db, bookingId)
  return (booking ?? null) as Record<string, unknown> | null
}

const bookingConfirmedResolver: StaffAlertContextResolver<"staff.booking.confirmed"> = {
  eventKey: "staff.booking.confirmed",
  async resolve({ db, payload }) {
    const bookingId = asString(payload.bookingId)
    if (!bookingId) return null
    const booking = await loadBooking(db as PostgresJsDatabase, bookingId)
    if (!booking) return null

    return {
      adminPath: `/bookings/${bookingId}`,
      // Bookings has no staff-owner column; see the README. Role routing
      // carries these alerts instead.
      assigneeUserId: null,
      actorUserId: asString(payload.actorId),
      bookingId,
      bookingNumber:
        asString(payload.bookingNumber) ?? asString(booking.bookingNumber) ?? bookingId,
      customer: partyFromBooking(booking),
      total: moneyFromBooking(booking),
      travelStartDate: asString(booking.startDate) ?? asString(booking.travelStartDate),
      travelEndDate: asString(booking.endDate) ?? asString(booking.travelEndDate),
      travelerCount: asNumber(booking.travelerCount) ?? asNumber(booking.paxCount),
    }
  },
}

const bookingCancelledResolver: StaffAlertContextResolver<"staff.booking.cancelled"> = {
  eventKey: "staff.booking.cancelled",
  async resolve({ db, payload }) {
    const bookingId = asString(payload.bookingId)
    if (!bookingId) return null
    const booking = await loadBooking(db as PostgresJsDatabase, bookingId)
    if (!booking) return null

    return {
      adminPath: `/bookings/${bookingId}`,
      assigneeUserId: null,
      actorUserId: asString(payload.actorId),
      bookingId,
      bookingNumber:
        asString(payload.bookingNumber) ?? asString(booking.bookingNumber) ?? bookingId,
      customer: partyFromBooking(booking),
      total: moneyFromBooking(booking),
      previousStatus: asString(payload.previousStatus) ?? "confirmed",
      reason: asString(payload.reason),
    }
  },
}

const paymentCompletedResolver: StaffAlertContextResolver<"staff.payment.completed"> = {
  eventKey: "staff.payment.completed",
  async resolve({ db, payload }) {
    const paymentSessionId = asString(payload.paymentSessionId)
    const amountCents = asNumber(payload.amountCents)
    const currency = asString(payload.currency)
    if (!paymentSessionId || amountCents === null || !currency) return null

    const bookingId = asString(payload.bookingId)
    const booking = bookingId ? await loadBooking(db as PostgresJsDatabase, bookingId) : null

    return {
      adminPath: bookingId ? `/bookings/${bookingId}` : `/finance/payments/${paymentSessionId}`,
      assigneeUserId: null,
      actorUserId: null,
      paymentSessionId,
      bookingId,
      bookingNumber: booking ? (asString(booking.bookingNumber) ?? bookingId) : null,
      customer: booking ? partyFromBooking(booking) : null,
      amount: { amountCents, currency },
      provider: asString(payload.provider) ?? "unknown",
      // The event does not say whether this settled the balance, and deciding
      // it here would mean reaching into finance's schedules. Null renders as
      // silence rather than a claim that might be wrong.
      paidInFull: null,
    }
  },
}

const invoiceSettledResolver: StaffAlertContextResolver<"staff.invoice.settled"> = {
  eventKey: "staff.invoice.settled",
  async resolve({ db, payload }) {
    const invoiceId = asString(payload.invoiceId) ?? asString(payload.id)
    if (!invoiceId) return null

    const bookingId = asString(payload.bookingId)
    const booking = bookingId ? await loadBooking(db as PostgresJsDatabase, bookingId) : null

    return {
      adminPath: `/finance/invoices/${invoiceId}`,
      assigneeUserId: null,
      actorUserId: asString(payload.actorId),
      invoiceId,
      invoiceNumber: asString(payload.invoiceNumber) ?? asString(payload.number),
      bookingId,
      bookingNumber: booking ? (asString(booking.bookingNumber) ?? bookingId) : null,
      customer: booking ? partyFromBooking(booking) : null,
      total: payloadMoney(payload),
    }
  },
}

function payloadMoney(payload: Record<string, unknown>) {
  const amountCents = asNumber(payload.totalCents) ?? asNumber(payload.amountCents)
  const currency = asString(payload.currency)
  if (amountCents === null || !currency) return null
  return { amountCents, currency }
}

const contractSignedResolver: StaffAlertContextResolver<"staff.contract.signed"> = {
  eventKey: "staff.contract.signed",
  async resolve({ db, payload }) {
    const contractId = asString(payload.contractId) ?? asString(payload.id)
    if (!contractId) return null

    const bookingId = asString(payload.bookingId)
    const booking = bookingId ? await loadBooking(db as PostgresJsDatabase, bookingId) : null

    return {
      adminPath: bookingId ? `/bookings/${bookingId}` : `/legal/contracts/${contractId}`,
      assigneeUserId: null,
      actorUserId: asString(payload.actorId),
      contractId,
      bookingId,
      bookingNumber: booking ? (asString(booking.bookingNumber) ?? bookingId) : null,
      signerName: asString(payload.signerName) ?? asString(payload.signedBy),
      signedAt: asString(payload.signedAt) ?? asString(payload.occurredAt),
    }
  },
}

const customerSignalCreatedResolver: StaffAlertContextResolver<"staff.customer-signal.created"> = {
  eventKey: "staff.customer-signal.created",
  async resolve({ db, payload }) {
    const signalId = asString(payload.id)
    if (!signalId) return null

    const database = db as PostgresJsDatabase
    const signal = await relationshipsService.getCustomerSignal(database, signalId)
    if (!signal) return null

    const person = signal.personId
      ? await relationshipsService.getPersonById(database, signal.personId)
      : null

    return {
      adminPath: `/crm/signals/${signalId}`,
      // The one alert with real assignee data behind it.
      assigneeUserId: signal.assignedToUserId ?? null,
      actorUserId: null,
      signalId,
      person: person
        ? {
            name: [person.firstName, person.lastName].filter(Boolean).join(" ").trim(),
            email: asString((person as Record<string, unknown>).email),
          }
        : null,
      kind: signal.kind,
      source: signal.source,
      priority: signal.priority,
      // Resolving a product title means asking inventory, which this package
      // does not depend on. The id is not worth showing a human, so the row is
      // omitted rather than filled with `prd_01H…`.
      productTitle: null,
      notes: signal.notes ?? null,
    }
  },
}

/** Every resolver, ready to register on the staff alert runtime. */
export const staffAlertContextResolvers: StaffAlertContextResolverRegistry = {
  "staff.booking.confirmed": bookingConfirmedResolver,
  "staff.booking.cancelled": bookingCancelledResolver,
  "staff.payment.completed": paymentCompletedResolver,
  "staff.invoice.settled": invoiceSettledResolver,
  "staff.contract.signed": contractSignedResolver,
  "staff.customer-signal.created": customerSignalCreatedResolver,
}

/**
 * Operator identity for the email shell, from `operator_profile`.
 *
 * `adminBaseUrl` is not in that table — it is deployment topology, not operator
 * data — so the host passes it in. Without it every deep link would be relative
 * and unusable from an inbox.
 */
export function createStaffAlertBrandResolver(options: { adminBaseUrl: string }) {
  return async function resolveBrand(db: PostgresJsDatabase): Promise<StaffAlertBrand> {
    const profile = await getOperatorProfile(db)
    return {
      operatorName: profile?.name ?? profile?.legalName ?? "Voyant",
      brandColor: normalizeBrandColor(profile?.brandColor ?? DEFAULT_STAFF_ALERT_BRAND_COLOR),
      cornerRadius: profile?.cornerRadius ?? DEFAULT_STAFF_ALERT_CORNER_RADIUS,
      // `logo_light_asset_key` is a storage key, not a URL, and resolving it
      // needs the storage port. Until that is wired the header renders the
      // operator's name as a wordmark — which Gmail shows and a blocked remote
      // image would not.
      logoUrl: null,
      supportEmail: profile?.supportEmail ?? profile?.email ?? null,
      adminBaseUrl: options.adminBaseUrl,
      locale: profile?.defaultLocale ?? "en",
    }
  }
}
