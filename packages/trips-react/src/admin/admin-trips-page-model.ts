// agent-quality: file-size exception -- owner: trips-react; composer model helpers stay co-located with the existing tests until the admin composer is split further.
import type { useOperatorAdminMessages as useAdminMessages } from "@voyant-travel/admin"
import { emptyPersonPickerValue } from "@voyant-travel/bookings-react/components/person-picker-section"
import { emptyTravelCreditPickerValue } from "@voyant-travel/bookings-react/components/travel-credit-picker-section"
import type {
  PaymentScheduleValue,
  PersonPickerValue,
  TravelCreditPickerValue,
} from "@voyant-travel/bookings-react/ui"
import { formatMessage } from "@voyant-travel/i18n"
import type { ReserveTripResult, TripComponent, TripEnvelopeStatus } from "@voyant-travel/trips"

import type { VoyantApiError } from "../client.js"
import type { AddTripComponentBody } from "../operations.js"
import {
  type ComponentBookingSetup,
  computePlaceholderTotals,
  flightPricingFromPending,
  type PendingComponent,
  pendingComponentIsValid,
  type TripTraveler,
} from "./admin-trips-panels.js"

export type AdminComposerMessages = ReturnType<typeof useAdminMessages>["trips"]["adminComposer"]

export const defaultPaymentCurrency = "EUR"

export function componentMutationsLockedForEnvelopeStatus(
  status: TripEnvelopeStatus | null | undefined,
): boolean {
  return status === "checkout_started" || status === "booked"
}

export type ReservePaymentScheduleValidationReason =
  | "paymentScheduleDueDateRequired"
  | "paymentScheduleSplitRowsRequired"
  | "paymentScheduleSplitTotalMismatch"

type ComponentPaymentScheduleRow = {
  scheduleType: "deposit" | "installment" | "balance" | "hold" | "other"
  status: "pending" | "due" | "paid" | "waived" | "cancelled" | "expired"
  dueDate: string
  currency: string
  amountCents: number
  notes?: string | null
}

export function metadataWithComponentBookingSetup(
  component: TripComponent,
  setup: ComponentBookingSetup,
): Record<string, unknown> {
  const metadata = { ...(readRecord(component.metadata) ?? {}) }
  const bookingDraft = { ...(readRecord(metadata.bookingDraftV1) ?? {}) }
  const documentGeneration = {
    contractDocument: setup.generateContractDocument,
    invoiceDocument: setup.generateInvoiceDocument,
  }
  metadata.bookingSetup = {
    paymentSchedule: setup.paymentSchedule,
    documentGeneration,
  }
  metadata.bookingDraftV1 = {
    ...bookingDraft,
    paymentSchedules: paymentScheduleToRows(
      setup.paymentSchedule,
      component.componentCurrency || defaultPaymentCurrency,
      component.componentTotalAmountCents ?? null,
    ),
    documentGeneration,
  }
  return metadata
}

export function paymentScheduleToRows(
  value: PaymentScheduleValue,
  scheduleCurrency: string,
  totalAmountCents: number | null,
): ComponentPaymentScheduleRow[] {
  if (value.mode === "full") {
    const installment = value.installments[0]
    if (!installment?.dueDate || totalAmountCents === null) return []
    return [
      {
        scheduleType: "balance",
        status: installment.alreadyPaid ? "paid" : "due",
        dueDate: installment.dueDate,
        currency: scheduleCurrency,
        amountCents: totalAmountCents,
        notes: paidScheduleNotes(
          installment.alreadyPaid,
          installment.paymentDate,
          installment.paymentMethod,
          installment.paymentReference,
        ),
      },
    ]
  }

  const rows: ComponentPaymentScheduleRow[] = []
  for (const installment of value.installments) {
    if (!installment.dueDate || installment.amountCents == null) continue
    rows.push({
      scheduleType: "installment",
      status: installment.alreadyPaid ? "paid" : "due",
      dueDate: installment.dueDate,
      currency: scheduleCurrency,
      amountCents: installment.amountCents,
      notes: paidScheduleNotes(
        installment.alreadyPaid,
        installment.paymentDate,
        installment.paymentMethod,
        installment.paymentReference,
      ),
    })
  }
  return rows
}

export function paymentScheduleReserveValidationReason(
  components: TripComponent[],
): ReservePaymentScheduleValidationReason | null {
  for (const component of components) {
    if (component.status === "removed" || component.status === "cancelled") continue
    if (component.kind !== "catalog_booking" || component.bookingId) continue

    const paymentSchedule = explicitPaymentScheduleFromComponent(component)
    if (!paymentSchedule) continue

    if (paymentSchedule.mode === "full") {
      if (!paymentSchedule.installments[0]?.dueDate) return "paymentScheduleDueDateRequired"
      continue
    }

    if (paymentSchedule.installments.length < 2) return "paymentScheduleSplitRowsRequired"
    for (const installment of paymentSchedule.installments) {
      if (!installment.dueDate || installment.amountCents == null) {
        return "paymentScheduleSplitRowsRequired"
      }
    }

    const total = component.componentTotalAmountCents
    if (typeof total === "number") {
      const scheduled = paymentSchedule.installments.reduce(
        (sum, installment) => sum + (installment.amountCents ?? 0),
        0,
      )
      if (scheduled !== total) return "paymentScheduleSplitTotalMismatch"
    }
  }
  return null
}

function explicitPaymentScheduleFromComponent(
  component: TripComponent,
): PaymentScheduleValue | null {
  const metadata = readRecord(component.metadata)
  const bookingSetup = readRecord(metadata?.bookingSetup)
  const paymentSchedule = readRecord(bookingSetup?.paymentSchedule)
  if (!paymentSchedule) return null
  const mode = paymentSchedule.mode
  if (mode !== "full" && mode !== "split") return null
  const installments = Array.isArray(paymentSchedule.installments)
    ? paymentSchedule.installments.flatMap((raw) => {
        const installment = readRecord(raw)
        if (!installment) return []
        return [
          {
            id: stringFromUnknown(installment.id) || "",
            amountCents:
              typeof installment.amountCents === "number" ? installment.amountCents : null,
            dueDate: stringFromUnknown(installment.dueDate),
            alreadyPaid: installment.alreadyPaid === true,
            paymentDate: stringFromUnknown(installment.paymentDate),
            paymentMethod: stringFromUnknown(installment.paymentMethod) || "bank_transfer",
            paymentReference: stringFromUnknown(installment.paymentReference) || "",
          },
        ]
      })
    : []

  return {
    mode,
    installments,
  }
}

// Returns a single-line audit note persisted on the booking's payment schedule
// when the operator marks an installment as already-paid in the composer.
// Operator-facing free text — kept terse and in English at the data layer so
// the persisted note stays comparable across deploys / locales.
function paidScheduleNotes(
  alreadyPaid: boolean,
  paymentDate: string | null,
  paymentMethod: string,
  paymentReference: string,
): string | null {
  if (!alreadyPaid) return null
  return [
    // i18n-literal-ok: persisted audit note, see comment above.
    "Marked paid in trips",
    paymentDate ? `date: ${paymentDate}` : null,
    paymentMethod ? `method: ${paymentMethod}` : null,
    paymentReference.trim() ? `reference: ${paymentReference.trim()}` : null,
  ]
    .filter(Boolean)
    .join("; ")
}

export function pendingToAddInput(
  pending: PendingComponent,
  ctx: {
    billing: PersonPickerValue
    travelers: TripTraveler[]
    payerName: string
    payerEmail: string
    paymentCurrency: string
  },
  messages: AdminComposerMessages,
): AddTripComponentBody | null {
  const billingPayload = serializeBilling(ctx.billing, ctx.payerName, ctx.payerEmail)
  const travelersPayload = serializeTravelersForBookingDraft(ctx.travelers, messages)
  const paxAdult = countAdults(ctx.travelers) || 1

  if (pending.kind === "product" || pending.kind === "stay") {
    if (!pending.catalogEntityId || !pending.catalogSourceKind) return null
    if (pending.kind === "stay" && !pendingComponentIsValid(pending)) return null
    const vertical = pending.kind === "stay" ? "accommodations" : "products"
    const draft = pending.bookingDraft
    const configure = {
      ...(draft?.configure ?? {}),
      pax: {
        ...(draft?.configure.pax ?? {}),
        adult: paxAdult,
      },
    }
    if (pending.startsAt) {
      configure.departureDate = pending.startsAt.slice(0, 10)
    }
    if (pending.startsAt && pending.endsAt) {
      configure.dateRange = {
        checkIn: pending.startsAt.slice(0, 10),
        checkOut: pending.endsAt.slice(0, 10),
      }
    }
    return {
      kind: "catalog_booking",
      catalogRef: {
        entityModule: vertical,
        entityId: pending.catalogEntityId,
        sourceKind: pending.catalogSourceKind,
        ...(pending.catalogSourceConnectionId
          ? { sourceConnectionId: pending.catalogSourceConnectionId }
          : {}),
        ...(pending.catalogSourceRef ? { sourceRef: pending.catalogSourceRef } : {}),
      },
      metadata: {
        scheduledStartsAt: pending.startsAt || null,
        scheduledEndsAt: pending.endsAt || null,
        catalogItem: {
          vertical,
          name: pending.catalogEntityName,
          thumbnailUrl: pending.catalogThumbnailUrl,
          sourceKind: pending.catalogSourceKind,
          sourceConnectionId: pending.catalogSourceConnectionId,
          sourceRef: pending.catalogSourceRef,
        },
        bookingDraftV1: {
          ...(draft ?? {}),
          entity: draft?.entity ?? {
            module: vertical,
            id: pending.catalogEntityId,
            sourceKind: pending.catalogSourceKind,
            ...(pending.catalogSourceConnectionId
              ? { sourceConnectionId: pending.catalogSourceConnectionId }
              : {}),
            ...(pending.catalogSourceRef ? { sourceRef: pending.catalogSourceRef } : {}),
          },
          configure,
          billing: billingPayload,
          travelers: travelersPayload,
          payment: draft?.payment ?? { intent: "hold" },
        },
      },
    }
  }

  if (pending.kind === "flight") {
    const pricing = flightPricingFromPending(pending)
    const firstItinerary = pending.selectedOffer?.itineraries[0]
    const lastItinerary =
      pending.selectedOffer?.itineraries[pending.selectedOffer.itineraries.length - 1]
    const firstSegment = firstItinerary?.segments[0]
    const lastSegment = lastItinerary?.segments[lastItinerary.segments.length - 1]
    return {
      kind: "flight_placeholder",
      description: undefined,
      estimatedPricing: {
        currency: pricing.currency,
        subtotalAmountCents: pricing.subtotalAmountCents,
        taxAmountCents: pricing.taxAmountCents,
        totalAmountCents: pricing.totalAmountCents,
      },
      metadata: {
        scheduledStartsAt: firstSegment?.departure.at ?? pending.departDate ?? null,
        scheduledEndsAt: lastSegment?.arrival.at ?? pending.returnDate ?? null,
        flightDraft: {
          origin: pending.origin,
          destination: pending.destination,
          departDate: pending.departDate,
          returnDate: pending.returnDate || null,
          tripType: pending.tripType,
          cabin: pending.cabin,
          offerId: pending.selectedOffer?.offerId ?? null,
          source: pending.selectedOffer?.source ?? null,
          selectedOffer: pending.selectedOffer,
          ancillaries: {
            fareBundle: pending.fareBundlePicks,
            baggage: pending.baggagePicks,
            assistance: pending.assistancePicks,
            extras: pending.extrasPicks,
          },
          pricing,
        },
      },
    }
  }

  if (pending.kind === "cruise") {
    const amountCents = parseAmountCents(pending.estimatedAmount)
    return {
      kind: "manual_placeholder",
      description: pending.description || undefined,
      estimatedPricing: pricingFromAmount(amountCents, ctx.paymentCurrency),
      metadata: {
        scheduledStartsAt: pending.embarkationDate || null,
        scheduledEndsAt: null,
        cruiseDraft: {
          cabin: pending.cabin || null,
          embarkationDate: pending.embarkationDate || null,
        },
      },
    }
  }

  const totals = computePlaceholderTotals(pending.subtotalCents, pending.taxRatePct)
  return {
    kind: "manual_placeholder",
    description: pending.description || undefined,
    estimatedPricing: {
      currency: pending.currency,
      subtotalAmountCents: totals.subtotal,
      taxAmountCents: totals.tax,
      totalAmountCents: totals.total,
    },
    metadata: {
      scheduledStartsAt: pending.startsAt || null,
      scheduledEndsAt: pending.endsAt || null,
      manualService: {
        name: pending.name,
      },
      taxRatePct: pending.taxRatePct || null,
      template: pending.kind,
    },
  }
}

function pricingFromAmount(amountCents: number, pricingCurrency: string) {
  return {
    currency: pricingCurrency,
    subtotalAmountCents: amountCents,
    taxAmountCents: 0,
    totalAmountCents: amountCents,
  }
}

function parseAmountCents(raw: string): number {
  const parsed = Number.parseFloat(raw || "0")
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0
}

function countAdults(travelers: TripTraveler[]): number {
  return travelers.filter((t) => t.role === "lead" || t.role === "adult").length
}

export function serializeBilling(
  billing: PersonPickerValue,
  payerNameFallback?: string,
  payerEmailFallback?: string,
) {
  if (billing.mode === "new") {
    return {
      buyerType: billing.billTo === "organization" ? "B2B" : "B2C",
      contact: {
        firstName: billing.newPerson.firstName.trim(),
        lastName: billing.newPerson.lastName.trim(),
        email: billing.newPerson.email.trim(),
        phone: billing.newPerson.phone || undefined,
      },
      address: {},
    }
  }
  // For an existing person we still need a contact block — the booking engine
  // validates `billing.contact` even when an id is present. Names/emails come
  // from the resolved person (payerName / payerEmail).
  const [firstName, ...rest] = (payerNameFallback ?? "").trim().split(/\s+/)
  return {
    buyerType: billing.billTo === "organization" ? "B2B" : "B2C",
    ...(billing.personId ? { personId: billing.personId } : {}),
    ...(billing.organizationId ? { organizationId: billing.organizationId } : {}),
    contact: {
      firstName: firstName || "",
      lastName: rest.join(" ") || "",
      email: payerEmailFallback || "",
    },
    address: {},
  }
}

export function assertTripCreationRequirements(
  ctx: {
    billing: PersonPickerValue
    travelers: TripTraveler[]
    payerName: string
    payerEmail: string
  },
  messages: AdminComposerMessages,
) {
  const errors: string[] = []
  const { errors: errorMessages } = messages
  if (ctx.billing.mode === "new") {
    if (!ctx.billing.newPerson.firstName.trim() || !ctx.billing.newPerson.lastName.trim()) {
      errors.push(errorMessages.requirementBillingName)
    }
    if (!isRealTripEmail(ctx.billing.newPerson.email)) {
      errors.push(errorMessages.requirementBillingEmail)
    }
  } else {
    const hasBillingRecord =
      ctx.billing.billTo === "organization"
        ? Boolean(ctx.billing.organizationId)
        : Boolean(ctx.billing.personId)
    if (!hasBillingRecord) errors.push(errorMessages.requirementBillingPersonOrOrg)
    if (!ctx.payerName.trim()) errors.push(errorMessages.requirementBillingName)
    if (!isRealTripEmail(ctx.payerEmail)) errors.push(errorMessages.requirementBillingEmail)
  }

  if (ctx.travelers.length === 0) {
    errors.push(errorMessages.requirementAtLeastOneTraveler)
  }
  ctx.travelers.forEach((traveler, index) => {
    if (!traveler.personId && (!traveler.firstName.trim() || !traveler.lastName.trim())) {
      errors.push(formatMessage(errorMessages.requirementTravelerName, { position: index + 1 }))
    }
    if (traveler.email && !isRealTripEmail(traveler.email)) {
      errors.push(formatMessage(errorMessages.requirementTravelerEmail, { position: index + 1 }))
    }
  })

  if (errors.length > 0) {
    throw new Error(
      formatMessage(errorMessages.completeRequirements, { fields: errors.join(", ") }),
    )
  }
}

function isRealTripEmail(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return !["noreply@example.com", "tbd@example.com", "traveler@example.com"].includes(normalized)
}

export function hydrateBilling(travelerParty: Record<string, unknown>): PersonPickerValue {
  const billing = readRecord(travelerParty.billing)
  if (!billing) return emptyPersonPickerValue
  const contact = readRecord(billing.contact)
  const personId = stringFromRecord(billing, "personId") ?? ""
  const organizationId = stringFromRecord(billing, "organizationId") ?? null
  const billTo =
    organizationId || stringFromRecord(billing, "buyerType") === "B2B" ? "organization" : "person"
  if (personId || organizationId) {
    return {
      billTo,
      mode: "existing",
      personId,
      organizationId,
      newPerson: emptyPersonPickerValue.newPerson,
    }
  }
  return {
    billTo,
    mode: "new",
    personId: "",
    organizationId,
    newPerson: {
      firstName: stringFromRecord(contact, "firstName") ?? "",
      lastName: stringFromRecord(contact, "lastName") ?? "",
      email: stringFromRecord(contact, "email") ?? "",
      phone: stringFromRecord(contact, "phone") ?? "",
    },
  }
}

export function hydrateTravelers(travelerParty: Record<string, unknown>): TripTraveler[] {
  const travelers = travelerParty.travelers
  if (!Array.isArray(travelers)) return []
  return travelers.filter(readRecord).map((traveler, index) => ({
    localId: stringFromRecord(traveler, "localId") ?? `tt_existing_${index}`,
    personId: stringFromRecord(traveler, "personId") ?? null,
    firstName: stringFromRecord(traveler, "firstName") ?? "",
    lastName: stringFromRecord(traveler, "lastName") ?? "",
    email: stringFromRecord(traveler, "email") ?? "",
    dateOfBirth: stringFromRecord(traveler, "dateOfBirth") ?? null,
    role: tripTravelerRoleFromStored(stringFromRecord(traveler, "role"), index),
  }))
}

export function hydrateTravelCredit(
  travelerParty: Record<string, unknown>,
): TravelCreditPickerValue {
  const travelCredit = readRecord(travelerParty.travelCredit)
  if (!travelCredit) return emptyTravelCreditPickerValue
  const id = stringFromRecord(travelCredit, "id")
  const code = stringFromRecord(travelCredit, "code")
  const currencyCode = stringFromRecord(travelCredit, "currency")
  const remainingAmountCents = numberFromRecord(travelCredit, "remainingAmountCents")
  if (!id || !code || !currencyCode || remainingAmountCents == null) {
    return emptyTravelCreditPickerValue
  }
  return {
    code,
    picked: {
      id,
      code,
      currency: currencyCode,
      remainingAmountCents,
      expiresAt: null,
    },
    error: null,
  }
}

export function tripTravelerRoleFromStored(
  value: string | undefined,
  index: number,
): TripTraveler["role"] {
  if (value === "lead" || value === "adult" || value === "child" || value === "infant") {
    return value
  }
  return index === 0 ? "lead" : "adult"
}

// Map our roster shape onto the catalog booking engine's `travelerEntryV1`:
// drop empty/null fields it can't validate, translate `role` (lead/adult/...)
// into `band` (adult/child/infant) + `isPrimary`.
function serializeTravelersForBookingDraft(
  travelers: TripTraveler[],
  messages: AdminComposerMessages,
) {
  return travelers.map((traveler) => {
    const band: "adult" | "child" | "infant" =
      traveler.role === "child" ? "child" : traveler.role === "infant" ? "infant" : "adult"
    const firstName = traveler.firstName.trim()
    const lastName = traveler.lastName.trim()
    const email = traveler.email.trim()
    const dateOfBirth = traveler.dateOfBirth?.trim() || ""
    const entry: Record<string, unknown> = {
      firstName: firstName || messages.travelerFallbackName,
      lastName: lastName || messages.travelerFallbackLastName,
      band,
    }
    if (email) entry.email = email
    if (dateOfBirth) entry.dateOfBirth = dateOfBirth
    if (traveler.role === "lead") entry.isPrimary = true
    return entry
  })
}

export function failuresToString(
  failures:
    | { reason: string; code?: string; details?: Record<string, unknown> | undefined }[]
    | undefined,
  messages: AdminComposerMessages,
) {
  if (!failures || failures.length === 0) return null
  if (failures.some((failure) => failure.code === "price_changed")) {
    return messages.failureMessages.priceChanged
  }
  if (failures.some((failure) => failure.code === "expired")) {
    return messages.failureMessages.expired
  }
  if (failures.some((failure) => failure.code === "unavailable")) {
    return messages.failureMessages.unavailable
  }
  if (
    failures.some(
      (failure) =>
        failure.code === "component_reservation_failed" ||
        failure.reason === "component_reservation_failed",
    )
  ) {
    return messages.failureMessages.reservationFailed
  }
  return failures.map((failure) => failure.reason).join(", ")
}

export function apiError(error: unknown, messages: AdminComposerMessages): string {
  const candidate = error as Partial<VoyantApiError>
  const body = candidate.body
  if (body && typeof body === "object" && "failures" in body) {
    const message = failuresToString(
      (
        body as {
          failures?: { reason: string; code?: string; details?: Record<string, unknown> }[]
        }
      ).failures,
      messages,
    )
    if (message) return message
  }
  if (typeof candidate.message === "string") return candidate.message
  return error instanceof Error ? error.message : messages.errors.requestFailed
}

export function reserveResultFromApiError(error: unknown): ReserveTripResult | null {
  const body = (error as Partial<VoyantApiError>).body
  if (!body || typeof body !== "object" || !("data" in body)) return null
  const data = (body as { data?: Partial<ReserveTripResult> }).data
  if (!data || typeof data !== "object") return null
  if (!data.envelope || !Array.isArray(data.components) || !Array.isArray(data.failures)) {
    return null
  }
  return data as ReserveTripResult
}

export function derivePayerName(
  billing: PersonPickerValue,
  person:
    | { firstName?: string | null; lastName?: string | null; email?: string | null }
    | undefined,
  messages: AdminComposerMessages,
): string {
  if (billing.mode === "new") {
    const name = [billing.newPerson.firstName, billing.newPerson.lastName]
      .filter((part) => part.trim().length > 0)
      .join(" ")
      .trim()
    return name || billing.newPerson.email.trim() || messages.travelerFallbackName
  }
  if (person) {
    const name = [person.firstName, person.lastName]
      .filter((part) => (part ?? "").trim().length > 0)
      .join(" ")
      .trim()
    return name || (person.email ?? "") || messages.travelerFallbackName
  }
  return messages.travelerFallbackName
}

export function derivePayerEmail(
  billing: PersonPickerValue,
  person: { email?: string | null } | undefined,
): string {
  if (billing.mode === "new") {
    return billing.newPerson.email.trim()
  }
  return person?.email ?? ""
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function stringFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = record?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function numberFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function booleanFromRecord(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}
