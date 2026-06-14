import type { bookingFulfillments, bookings } from "@voyant-travel/bookings/schema"
import type {
  optionUnits,
  productFaqs,
  productFeatures,
  productLocations,
  productOptions,
  products,
} from "@voyant-travel/inventory/schema"
import type { availabilitySlots, availabilityStartTimes } from "@voyant-travel/operations"
import type { z } from "zod"

import type {
  OctoAvailabilityStatus,
  OctoAvailabilityType,
  OctoBookingStatus,
  OctoProjectedAvailability,
  OctoProjectedProductContent,
  OctoProjectedUnit,
  OctoUnitType,
} from "./types.js"
import type {
  octoAvailabilityCalendarQuerySchema,
  octoAvailabilityListQuerySchema,
  octoBookingListQuerySchema,
  octoProductListQuerySchema,
} from "./validation.js"

export type ProductRow = typeof products.$inferSelect
export type OptionRow = typeof productOptions.$inferSelect
export type UnitRow = typeof optionUnits.$inferSelect
export type SlotRow = typeof availabilitySlots.$inferSelect
export type BookingRow = typeof bookings.$inferSelect
export type OctoAvailabilityListQuery = z.infer<typeof octoAvailabilityListQuerySchema>
export type OctoAvailabilityCalendarQuery = z.infer<typeof octoAvailabilityCalendarQuerySchema>
export type OctoProductListQuery = z.infer<typeof octoProductListQuerySchema>
export type OctoBookingListQuery = z.infer<typeof octoBookingListQuerySchema>

export function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

export function formatLocalDateTime(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(value)

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second}`
}

export function inferOctoAvailabilityType(
  bookingMode: ProductRow["bookingMode"],
): OctoAvailabilityType {
  return bookingMode === "open" ? "OPENING_HOURS" : "START_TIME"
}

export function inferOctoUnitType(unit: Pick<UnitRow, "name" | "code" | "unitType">): OctoUnitType {
  const haystack = `${unit.code ?? ""} ${unit.name}`.toLowerCase()

  if (haystack.includes("adult")) return "ADULT"
  if (haystack.includes("child")) return "CHILD"
  if (haystack.includes("youth") || haystack.includes("teen")) return "YOUTH"
  if (haystack.includes("infant") || haystack.includes("baby")) return "INFANT"
  if (haystack.includes("family")) return "FAMILY"
  if (haystack.includes("senior")) return "SENIOR"
  if (haystack.includes("student")) return "STUDENT"
  if (haystack.includes("military")) return "MILITARY"

  return unit.unitType === "person" ? "ADULT" : "OTHER"
}

export function deriveOctoAvailabilityStatus(
  slot: Pick<SlotRow, "status" | "unlimited" | "initialPax" | "remainingPax">,
  capacityMode: ProductRow["capacityMode"] | null | undefined,
): OctoAvailabilityStatus {
  if (slot.status === "sold_out") return "SOLD_OUT"
  if (slot.status === "closed" || slot.status === "cancelled") return "CLOSED"
  if (capacityMode === "free_sale" || slot.unlimited) return "FREESALE"

  if (
    slot.initialPax !== null &&
    slot.initialPax !== undefined &&
    slot.remainingPax !== null &&
    slot.remainingPax !== undefined
  ) {
    if (slot.remainingPax <= 0) return "SOLD_OUT"
    if (slot.initialPax > 0 && slot.remainingPax / slot.initialPax < 0.5) return "LIMITED"
  }

  return "AVAILABLE"
}

export function mapBookingStatus(status: BookingRow["status"]): OctoBookingStatus {
  switch (status) {
    case "on_hold":
      return "ON_HOLD"
    case "expired":
      return "EXPIRED"
    case "cancelled":
      return "CANCELLED"
    default:
      return "CONFIRMED"
  }
}

export function mapUnit(unit: UnitRow): OctoProjectedUnit {
  return {
    id: unit.id,
    name: unit.name,
    code: unit.code,
    type: inferOctoUnitType(unit),
    restrictions: {
      minAge: unit.minAge ?? undefined,
      maxAge: unit.maxAge ?? undefined,
      minQuantity: unit.minQuantity ?? undefined,
      maxQuantity: unit.maxQuantity ?? undefined,
      occupancyMin: unit.occupancyMin ?? undefined,
      occupancyMax: unit.occupancyMax ?? undefined,
    },
  }
}

export function buildProductContent({
  features,
  faqs,
  locations,
}: {
  features: Array<typeof productFeatures.$inferSelect>
  faqs: Array<typeof productFaqs.$inferSelect>
  locations: Array<typeof productLocations.$inferSelect>
}): OctoProjectedProductContent {
  return {
    highlights: features
      .filter((feature) => feature.featureType === "highlight" || feature.featureType === "other")
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
      })),
    inclusions: features
      .filter((feature) => feature.featureType === "inclusion")
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
      })),
    exclusions: features
      .filter((feature) => feature.featureType === "exclusion")
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
      })),
    importantInformation: features
      .filter((feature) => feature.featureType === "important_information")
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        description: feature.description,
      })),
    faqs: faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
    })),
    locations: locations.map((location) => ({
      id: location.id,
      type: location.locationType,
      title: location.title,
      address: location.address,
      city: location.city,
      countryCode: location.countryCode,
      latitude: location.latitude,
      longitude: location.longitude,
      googlePlaceId: location.googlePlaceId,
      applePlaceId: location.applePlaceId,
      tripadvisorLocationId: location.tripadvisorLocationId,
    })),
  }
}

export function pickOptionStartTimes(
  option: OptionRow,
  startTimes: Array<typeof availabilityStartTimes.$inferSelect>,
) {
  const optionTimes = startTimes.filter((startTime) => startTime.optionId === option.id)
  const sharedTimes = startTimes.filter((startTime) => startTime.optionId === null)
  const source = optionTimes.length > 0 ? optionTimes : sharedTimes
  return source.map((startTime) => startTime.startTimeLocal)
}

export function pickBookingContact(params: {
  booking: {
    contactFirstName: string | null
    contactLastName: string | null
    contactEmail: string | null
    contactPhone: string | null
    contactPreferredLanguage: string | null
  }
  participants: Array<{
    participantType: string | null
    isPrimary: boolean | null
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    preferredLanguage: string | null
  }>
}) {
  const { booking, participants } = params
  const hasBookingContact = Boolean(
    booking.contactFirstName ??
      booking.contactLastName ??
      booking.contactEmail ??
      booking.contactPhone ??
      booking.contactPreferredLanguage,
  )

  if (hasBookingContact) {
    return {
      travelerId: null,
      firstName: booking.contactFirstName,
      lastName: booking.contactLastName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
      language: booking.contactPreferredLanguage,
    }
  }

  const nonStaffParticipants = participants.filter(
    (participant) => participant.participantType !== "staff",
  )
  const preferred =
    nonStaffParticipants.find((participant) => participant.isPrimary) ??
    nonStaffParticipants.find((participant) =>
      ["traveler", "occupant"].includes(participant.participantType ?? ""),
    ) ??
    nonStaffParticipants[0] ??
    participants.find((participant) => participant.isPrimary) ??
    participants[0]

  if (!preferred) return null

  return {
    travelerId: preferred.id,
    firstName: preferred.firstName,
    lastName: preferred.lastName,
    email: preferred.email,
    phone: preferred.phone,
    language: preferred.preferredLanguage,
  }
}

export function pickPayloadString(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!payload) return null

  for (const key of keys) {
    const value = payload[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }

  return null
}

export function mapBookingArtifact(fulfillment: typeof bookingFulfillments.$inferSelect) {
  const payload = fulfillment.payload ?? null
  const artifactUrl = fulfillment.artifactUrl
  const downloadUrl =
    pickPayloadString(payload, ["downloadUrl", "download_url", "url"]) ?? artifactUrl ?? null
  const pdfUrl =
    pickPayloadString(payload, ["pdfUrl", "pdf_url"]) ??
    (fulfillment.fulfillmentType === "pdf" ? artifactUrl : null)
  const qrCode =
    pickPayloadString(payload, ["qrCode", "qr_code"]) ??
    (fulfillment.fulfillmentType === "qr_code"
      ? pickPayloadString(payload, ["code", "voucherCode", "voucher_code"])
      : null)
  const barcode =
    pickPayloadString(payload, ["barcode", "barcodeValue", "barcode_value"]) ??
    (fulfillment.fulfillmentType === "barcode"
      ? pickPayloadString(payload, ["code", "voucherCode", "voucher_code"])
      : null)
  const voucherCode = pickPayloadString(payload, ["voucherCode", "voucher_code", "code"])

  return {
    fulfillmentId: fulfillment.id,
    bookingItemId: fulfillment.bookingItemId,
    travelerId: fulfillment.travelerId,
    type: fulfillment.fulfillmentType,
    deliveryChannel: fulfillment.deliveryChannel,
    status: fulfillment.status,
    artifactUrl,
    downloadUrl,
    pdfUrl,
    qrCode,
    barcode,
    voucherCode,
    issuedAt: toIsoString(fulfillment.issuedAt),
    revokedAt: toIsoString(fulfillment.revokedAt),
  }
}

export function buildProjectedAvailability(
  slot: SlotRow,
  product: Pick<ProductRow, "capacityMode" | "timezone"> | null | undefined,
): OctoProjectedAvailability {
  const timeZone = slot.timezone || product?.timezone || "UTC"

  return {
    id: slot.id,
    productId: slot.productId,
    optionId: slot.optionId,
    localDateTimeStart: formatLocalDateTime(slot.startsAt, timeZone),
    localDateTimeEnd: slot.endsAt ? formatLocalDateTime(slot.endsAt, timeZone) : null,
    timeZone,
    status: deriveOctoAvailabilityStatus(slot, product?.capacityMode),
    vacancies: slot.unlimited ? null : slot.remainingPax,
    capacity: slot.unlimited ? null : slot.initialPax,
  }
}
