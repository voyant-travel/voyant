export interface BillingRecordValue {
  buyerType?: string
  personId?: string
  organizationId?: string
  contact?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
}

export interface TripTravelerRecord {
  localId?: string
  personId?: string | null
  firstName?: string
  lastName?: string
  email?: string
  role?: string
}

export function readBilling(travelerParty: Record<string, unknown>): BillingRecordValue | null {
  const billing = travelerParty.billing
  if (!isRecord(billing)) return null
  const contact = isRecord(billing.contact) ? billing.contact : undefined
  return {
    buyerType: stringValue(billing.buyerType),
    personId: stringValue(billing.personId),
    organizationId: stringValue(billing.organizationId),
    contact: contact
      ? {
          firstName: stringValue(contact.firstName),
          lastName: stringValue(contact.lastName),
          email: stringValue(contact.email),
          phone: stringValue(contact.phone),
        }
      : undefined,
  }
}

export function readTravelers(travelerParty: Record<string, unknown>): TripTravelerRecord[] {
  const travelers = travelerParty.travelers
  if (!Array.isArray(travelers)) return []
  return travelers.filter(isRecord).map((traveler) => ({
    localId: stringValue(traveler.localId),
    personId: stringValue(traveler.personId) ?? null,
    firstName: stringValue(traveler.firstName),
    lastName: stringValue(traveler.lastName),
    email: stringValue(traveler.email),
    role: stringValue(traveler.role),
  }))
}

export function formatPersonName(
  person:
    | {
        firstName?: string | null
        lastName?: string | null
        email?: string | null
      }
    | undefined
    | null,
): string | null {
  if (!person) return null
  const name = [person.firstName, person.lastName]
    .filter((part) => (part ?? "").trim().length > 0)
    .join(" ")
    .trim()
  return name || person.email || null
}

export function formatContactName(contact: BillingRecordValue["contact"]): string | null {
  if (!contact) return null
  const name = [contact.firstName, contact.lastName]
    .filter((part) => (part ?? "").trim().length > 0)
    .join(" ")
    .trim()
  return name || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}
