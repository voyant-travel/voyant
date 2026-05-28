/**
 * Booking PII redaction.
 *
 * Booking rows and traveler rows store contact identifiers (name, email,
 * phone) as plaintext columns so the operator UI can search and sort. The
 * `bookings-pii:*` scope (or `*` superuser scope) gates the right to see
 * those identifiers verbatim. Callers without that scope receive a redacted
 * shape that retains enough signal for operational triage but not enough to
 * exfiltrate a full contact list.
 *
 * **Scope of this module:** route-layer redaction at the API boundary.
 * Internal callers (cron jobs, workflows, in-process tasks) bypass redaction
 * because they need the full record to do their job.
 *
 * **What this does NOT do:** encrypt the columns at rest. That is a
 * follow-up requiring a schema migration + a search-tokenisation strategy
 * (see issue #283 follow-up). For now plaintext-on-disk + redact-in-flight
 * is the documented posture.
 */

const PII_SCOPE_ANY = "bookings-pii:*"
const PII_SCOPE_READ = "bookings-pii:read"
const SUPERUSER_SCOPE = "*"

export interface PiiAccessContext {
  actor?: string | null
  scopes?: string[] | null
  callerType?: string | null
  isInternalRequest?: boolean
}

/**
 * Returns true when the caller has earned the right to see PII in the clear.
 *
 * Internal requests (server-to-server inside the trust boundary), staff
 * dashboard sessions, and API keys with explicit `bookings-pii:read`
 * scope (or superuser `*`) reveal.
 */
export function shouldRevealBookingPii(ctx: PiiAccessContext): boolean {
  if (ctx.isInternalRequest) return true
  if (ctx.actor === "staff") return true
  const scopes = ctx.scopes ?? []
  return (
    scopes.includes(SUPERUSER_SCOPE) ||
    scopes.includes(PII_SCOPE_ANY) ||
    scopes.includes(PII_SCOPE_READ)
  )
}

/**
 * Mask the local-part of an email, preserving the domain so the operator
 * can tell at a glance which provider is involved.
 *
 * `alice@example.com` → `a***e@example.com`
 * `bo@example.com`    → `**@example.com`
 */
export function redactEmail(email: string | null | undefined): string | null {
  if (email == null) return email ?? null
  const at = email.lastIndexOf("@")
  if (at < 1) return "***"
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) return `${"*".repeat(local.length)}${domain}`
  return `${local[0]}***${local[local.length - 1]}${domain}`
}

/**
 * Mask all but the last four digits of a phone number, dropping
 * non-digit characters from the masked region so the result is recognisable
 * as a phone fragment.
 *
 * `+40 712 345 678` → `***5678`
 */
export function redactPhone(phone: string | null | undefined): string | null {
  if (phone == null) return phone ?? null
  const digits = phone.replace(/\D/g, "")
  if (digits.length <= 4) return "***"
  return `***${digits.slice(-4)}`
}

/**
 * Masks an arbitrary identifier like a postal address or city to a single-
 * char marker. We keep the field present so client schemas don't break,
 * but the value is effectively absent.
 */
export function redactString(value: string | null | undefined): string | null {
  if (value == null) return value ?? null
  return value.length === 0 ? value : "***"
}

/**
 * Booking row contact-PII redaction. Returns a shallow copy with the
 * `contact*` columns masked. Caller is responsible for not running this on
 * already-redacted rows.
 */
export function redactBookingContact<
  T extends {
    contactFirstName?: string | null
    contactLastName?: string | null
    contactTaxId?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    contactAddressLine1?: string | null
    contactAddressLine2?: string | null
    contactPostalCode?: string | null
  },
>(row: T): T {
  return {
    ...row,
    contactFirstName: redactString(row.contactFirstName),
    contactLastName: redactString(row.contactLastName),
    contactTaxId: redactString(row.contactTaxId),
    contactEmail: redactEmail(row.contactEmail),
    contactPhone: redactPhone(row.contactPhone),
    contactAddressLine1: redactString(row.contactAddressLine1),
    contactAddressLine2: redactString(row.contactAddressLine2),
    contactPostalCode: redactString(row.contactPostalCode),
  }
}

/**
 * Traveler row redaction. Same shape as `redactBookingContact` but for
 * traveler identity columns.
 *
 * `accessibilityNeeds` is intentionally NOT in the redacted set — it was
 * moved to the encrypted `bookingTravelerTravelDetails` table (#283) and
 * is only ever returned through `createBookingPiiService` after
 * decryption + audit. It's never present on this row shape.
 */
export function redactTravelerIdentity<
  T extends {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    specialRequests?: string | null
    notes?: string | null
  },
>(row: T): T {
  return {
    ...row,
    firstName: redactString(row.firstName),
    lastName: redactString(row.lastName),
    email: redactEmail(row.email),
    phone: redactPhone(row.phone),
    specialRequests: redactString(row.specialRequests),
    notes: redactString(row.notes),
  }
}
