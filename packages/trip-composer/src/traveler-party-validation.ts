import { TripComposerInvariantError } from "./service-types.js"

const placeholderEmails = new Set([
  "noreply@example.com",
  "tbd@example.com",
  "traveler@example.com",
])

export function assertTripTravelerPartyComplete(
  travelerParty: Record<string, unknown>,
  context = "Trip",
): void {
  const errors = validateTripTravelerParty(travelerParty)
  if (errors.length === 0) return
  throw new TripComposerInvariantError(`${context} requires ${errors.join(", ")}`)
}

export function validateTripTravelerParty(travelerParty: Record<string, unknown>): string[] {
  const errors: string[] = []
  const billing = asRecord(travelerParty.billing)
  const contact = asRecord(billing?.contact)
  const billingEmail = stringValue(contact?.email)
  const billingFirstName = stringValue(contact?.firstName)
  const billingLastName = stringValue(contact?.lastName)
  const billingPersonId = stringValue(billing?.personId)
  const billingOrganizationId = stringValue(billing?.organizationId)

  if (!billing) {
    errors.push("billing information")
  } else {
    if (!billingPersonId && !billingOrganizationId && (!billingFirstName || !billingLastName)) {
      errors.push("a billing person, organization, or full billing contact name")
    }
    if (!isRealEmail(billingEmail)) {
      errors.push("a real billing email")
    }
  }

  const travelers = Array.isArray(travelerParty.travelers)
    ? travelerParty.travelers
        .map(asRecord)
        .filter((traveler): traveler is Record<string, unknown> => Boolean(traveler))
    : []

  if (travelers.length === 0) {
    errors.push("at least one traveler")
  }

  travelers.forEach((traveler, index) => {
    const personId = stringValue(traveler.personId)
    const firstName = stringValue(traveler.firstName)
    const lastName = stringValue(traveler.lastName)
    const email = stringValue(traveler.email)
    if (!personId && (!firstName || !lastName)) {
      errors.push(`traveler ${index + 1} name or person record`)
    }
    if (email && !isRealEmail(email)) {
      errors.push(`traveler ${index + 1} real email`)
    }
  })

  return errors
}

function isRealEmail(value: string | null): value is string {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !placeholderEmails.has(normalized)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
