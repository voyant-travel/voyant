/**
 * Default mapping from a `BookingDraftV1` to the variable schema
 * the storefront's contract templates expect.
 *
 * Templates render against a flat dictionary so the contract author
 * can drop `{{ buyer.name }}` / `{{ booking.totalPrice }}` etc. We
 * mirror protravel's variable shape so existing template content
 * ports cleanly.
 *
 * Verticals can compose this default with their own additions —
 * cruises bolt on `{{ ship }}` / `{{ embarkation }}`, hospitality
 * adds `{{ checkIn }}` / `{{ checkOut }}` etc.
 */

import type { BookingEntitySummary } from "@voyantjs/booking-journey-ui"
import type { BookingDraftV1 } from "@voyantjs/catalog/booking-engine"

interface ResolveContractVariablesContext {
  entityModule: string
  entityId: string
  entitySummary?: BookingEntitySummary
}

export function resolveContractVariables(
  draft: BookingDraftV1,
  ctx: ResolveContractVariablesContext,
): Record<string, unknown> {
  const billing = draft.billing
  const contact = billing.contact
  const address = billing.address
  const summary = ctx.entitySummary

  const passengers = draft.travelers.map((t, i) => ({
    index: i + 1,
    band: t.band,
    firstName: t.firstName,
    lastName: t.lastName,
    fullName: [t.firstName, t.lastName].filter(Boolean).join(" ").trim(),
    email: t.email ?? "",
    phone: t.phone ?? "",
    dateOfBirth: t.dateOfBirth ?? "",
    documentType: stringFromDoc(t.documents, "documentType"),
    documentNumber: stringFromDoc(t.documents, "documentNumber"),
    documentExpiry: stringFromDoc(t.documents, "documentExpiry"),
  }))

  return {
    today: new Date().toISOString().slice(0, 10),
    booking: {
      entityModule: ctx.entityModule,
      entityId: ctx.entityId,
      productName: summary?.name ?? ctx.entityId,
      productSubtitle: summary?.subtitle ?? "",
      whenLabel: summary?.whenLabel ?? "",
      locationLabel: summary?.locationLabel ?? "",
      paxTotal: passengers.length,
      paxAdult: draft.configure?.pax?.adult ?? 0,
      paxChild: draft.configure?.pax?.child ?? 0,
      paxInfant: draft.configure?.pax?.infant ?? 0,
      departureSlotId: draft.configure?.departureSlotId ?? "",
      departureDate: draft.configure?.departureDate ?? "",
      checkIn: draft.configure?.dateRange?.checkIn ?? "",
      checkOut: draft.configure?.dateRange?.checkOut ?? "",
      cabinCategoryId: draft.configure?.cabinCategoryId ?? "",
    },
    buyer: {
      type: billing.buyerType,
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim(),
      email: contact.email,
      phone: contact.phone ?? "",
      companyName: billing.company?.name ?? "",
      vatId: billing.company?.vatId ?? "",
      addressLine1: address.line1 ?? "",
      addressLine2: address.line2 ?? "",
      city: address.city ?? "",
      postal: address.postal ?? "",
      country: address.country ?? "",
    },
    payment: {
      intent: draft.payment.intent,
    },
    passengers,
  }
}

function stringFromDoc(documents: Record<string, unknown> | undefined, key: string): string {
  const value = documents?.[key]
  return typeof value === "string" ? value : ""
}
