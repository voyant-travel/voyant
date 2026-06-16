import type { SynthesizedTripBilling, TripBillingInfo } from "./types.js"

export function readTripBilling(travelerParty: Record<string, unknown>): TripBillingInfo {
  const billing = asRecord(travelerParty.billing)
  const contact = asRecord(billing?.contact)
  return {
    buyerType: stringValue(billing?.buyerType),
    personId: stringValue(billing?.personId),
    organizationId: stringValue(billing?.organizationId),
    contact: {
      firstName: stringValue(contact?.firstName),
      lastName: stringValue(contact?.lastName),
      email: stringValue(contact?.email),
      phone: stringValue(contact?.phone),
    },
  }
}

export function formatTripBillingName(billing: TripBillingInfo): string | null {
  return [billing.contact?.firstName, billing.contact?.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim()
    ? [billing.contact?.firstName, billing.contact?.lastName]
        .filter((part): part is string => Boolean(part))
        .join(" ")
    : null
}

export function synthesizeTripBilling(billing: TripBillingInfo): SynthesizedTripBilling {
  const names = splitTripBillingName(formatTripBillingName(billing) ?? "Trip customer")
  return {
    email: billing.contact?.email ?? "",
    phone: billing.contact?.phone ?? "0000000000",
    firstName: names.firstName,
    lastName: names.lastName,
    city: "TBD",
    country: 642,
    state: "TBD",
    postalCode: "00000",
    details: "Pending — customer to confirm at payment.",
  }
}

export function splitTripBillingName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? "Trip",
    lastName: parts.slice(1).join(" ") || "Customer",
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
