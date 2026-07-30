/**
 * Catalog's provider for `finance.self-service-booking-source.runtime`.
 *
 * Finance owns the durable create command; catalog owns the draft, quote, and
 * hold a public caller built it from. This module is the seam between them: it
 * verifies that state, asks the owning vertical to derive a command, and later
 * spends the state inside Finance's transaction.
 *
 * Everything the command contains is derived here or by the vertical handler.
 * A public caller supplies only identifiers — never prices, booking numbers,
 * relationship ids, tax lines, or status.
 */
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { PricingBasis } from "../snapshot/schema.js"
import { bookingDraftsTable } from "./drafts-schema.js"
import { markDraftConsumed } from "./drafts-service.js"
import type { OwnedBookingHandlerRegistry, SelfServiceBillingParty } from "./owned-handler.js"
import { catalogQuotesTable, type SelectCatalogQuote } from "./schema.js"

/** Resolve or create the CRM person a booking is billed to. */
export type ResolveSelfServiceBillingPerson = (
  contact: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
  },
  provenance: { source: string; sourceRef: string },
) => Promise<string | null>

export interface SelfServiceBookingSourceProviderDeps {
  /** Resolved per request, matching how other catalog jobs reach the registry. */
  resolveOwnedHandlers():
    | OwnedBookingHandlerRegistry
    | Promise<OwnedBookingHandlerRegistry | undefined>
    | undefined
  /**
   * Optional CRM resolver. Only called once the whole party would pass the
   * create command's own validation — resolving persists a person before the
   * durable claim exists, so a party that would be rejected downstream must
   * never reach it, or every failed attempt orphans a CRM row.
   *
   * Without it an authenticated customer can still book (they already are the
   * billing party); a verified guest is rejected as `incomplete_draft`.
   */
  resolveBillingPerson?: ResolveSelfServiceBillingPerson
}

type Rejection = { status: "rejected"; reason: string }

const reject = (reason: string): Rejection => ({ status: "rejected", reason })

export function createSelfServiceBookingSourceProvider(deps: SelfServiceBookingSourceProviderDeps) {
  return {
    async resolveBookingSource(input: {
      db: PostgresJsDatabase
      draftId: string
      quoteId: string
      caller: {
        personId?: string
        verifiedEmail?: string
        verifiedPhone?: string
      }
    }) {
      const draft = await loadDraft(input.db, input.draftId)
      if (!draft) return reject("draft_not_found")
      if (draft.consumed_booking_id) return reject("draft_consumed")

      const quote = await loadQuote(input.db, input.quoteId)
      if (!quote) return reject("quote_not_found")
      if (quote.consumed_booking_id) return reject("quote_consumed")

      const now = new Date()
      if (quote.expires_at <= now) return reject("quote_expired")
      // The quote must be for the row this draft is building, or a caller
      // could pair a cheap quote with a different entity.
      if (quote.entity_module !== draft.entity_module || quote.entity_id !== draft.entity_id) {
        return reject("entity_mismatch")
      }
      // Only the draft's own current quote is spendable.
      if (draft.current_quote_id && draft.current_quote_id !== quote.id) {
        return reject("price_changed")
      }
      if (draft.hold_expires_at && draft.hold_expires_at <= now) return reject("hold_expired")

      const ownedHandlers = await deps.resolveOwnedHandlers()
      const handler = ownedHandlers?.resolve(draft.entity_module)
      if (!handler?.deriveSelfServiceCommand) return reject("unsupported_vertical")

      const payload = (draft.draft_payload ?? {}) as {
        billing?: { contact?: Record<string, string | null | undefined> }
        travelers?: unknown[]
      }
      const contact = billingContact(payload.billing?.contact)

      // The challenge proved control of one contact point. Requiring the
      // draft's billing contact to match it is what stops a challenge
      // verified for one address from booking against another.
      if (!callerMatchesContact(input.caller, contact)) return reject("contact_mismatch")

      const billing = await resolveBilling(deps, input.caller, contact, payload, input.draftId)
      if (!billing) return reject("incomplete_draft")

      const derived = await handler.deriveSelfServiceCommand(
        { db: input.db, adapterContext: {} as never },
        {
          entityModule: draft.entity_module,
          entityId: draft.entity_id,
          draft: draft.draft_payload,
          ...(readPricingFromQuote(quote) ? { pricing: readPricingFromQuote(quote) } : {}),
          billing,
          // Owned holds are keyed by draft id (see the products handler's
          // `placeHold`), so an active hold is identified by the draft itself.
          ...(draft.hold_expires_at ? { availabilityHoldToken: draft.id } : {}),
        },
      )
      if (derived.status !== "ok") return reject(derived.reason)

      return {
        status: "ok" as const,
        command: derived.command,
        holdExpiresAt: draft.hold_expires_at ?? null,
      }
    },

    /**
     * Spend the draft and quote inside Finance's transaction. Reached only on
     * a first execution — an exact retry replays at the claim and skips this.
     */
    async consumeBookingSource(
      tx: AnyDrizzleDb,
      input: { draftId: string; quoteId: string; bookingId: string },
    ) {
      await markDraftConsumed(tx, input.draftId, input.bookingId)
      await tx
        .update(catalogQuotesTable)
        .set({ consumed_booking_id: input.bookingId })
        .where(eq(catalogQuotesTable.id, input.quoteId))
    },
  }
}

async function resolveBilling(
  deps: SelfServiceBookingSourceProviderDeps,
  caller: { personId?: string },
  contact: ReturnType<typeof billingContact>,
  payload: { travelers?: unknown[] },
  draftId: string,
): Promise<SelfServiceBillingParty | null> {
  const base = {
    contactFirstName: contact.firstName,
    contactLastName: contact.lastName,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    organizationId: null,
  }
  // An authenticated customer already is the billing party.
  if (caller.personId) return { ...base, personId: caller.personId }
  if (!deps.resolveBillingPerson) return null

  // Guard before resolving: a person persisted for a party the create command
  // would reject is an orphaned CRM row on every retry.
  const hasName = Boolean(contact.firstName?.trim()) && Boolean(contact.lastName?.trim())
  const hasContactPoint = Boolean(contact.email) || Boolean(contact.phone)
  const hasTravelers = Array.isArray(payload.travelers) && payload.travelers.length > 0
  if (!hasName || !hasContactPoint || !hasTravelers) return null

  const personId = await deps.resolveBillingPerson(contact, {
    source: "storefront-self-service",
    sourceRef: draftId,
  })
  return personId ? { ...base, personId } : null
}

function callerMatchesContact(
  caller: { personId?: string; verifiedEmail?: string; verifiedPhone?: string },
  contact: ReturnType<typeof billingContact>,
): boolean {
  // An authenticated customer is identified by their account, not a challenge.
  if (caller.personId) return true
  const email = contact.email?.trim().toLowerCase()
  const phone = contact.phone?.trim()
  if (caller.verifiedEmail && email) return caller.verifiedEmail.trim().toLowerCase() === email
  if (caller.verifiedPhone && phone) return caller.verifiedPhone.trim() === phone
  return false
}

function billingContact(contact: Record<string, string | null | undefined> | undefined) {
  const trim = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
  return {
    firstName: trim(contact?.firstName),
    lastName: trim(contact?.lastName),
    email: trim(contact?.email),
    phone: trim(contact?.phone),
  }
}

async function loadDraft(db: PostgresJsDatabase, id: string) {
  const rows = await db
    .select()
    .from(bookingDraftsTable)
    .where(eq(bookingDraftsTable.id, id))
    .limit(1)
  return rows[0]
}

async function loadQuote(db: PostgresJsDatabase, id: string) {
  const rows = await db
    .select()
    .from(catalogQuotesTable)
    .where(eq(catalogQuotesTable.id, id))
    .limit(1)
  return rows[0]
}

function readPricingFromQuote(quote: SelectCatalogQuote): PricingBasis | undefined {
  const baseRaw = quote.pricing_base_amount
  if (baseRaw == null) return undefined
  const base = typeof baseRaw === "string" ? Number.parseFloat(baseRaw) : Number(baseRaw)
  if (!Number.isFinite(base)) return undefined
  const currency = quote.pricing_currency
  if (!currency) return undefined
  return {
    base_amount: base,
    taxes: numericOrZero(quote.pricing_taxes),
    fees: numericOrZero(quote.pricing_fees),
    surcharges: numericOrZero(quote.pricing_surcharges),
    currency,
    breakdown: quote.pricing_breakdown ?? undefined,
    appliedOffers: quote.pricing_applied_offers ?? undefined,
  }
}

function numericOrZero(value: unknown): number {
  if (value == null) return 0
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
