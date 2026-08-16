import type {
  BookingPaymentCheckoutV1,
  BookingSessionBankTransferV1,
} from "@voyant-travel/catalog-contracts/booking-engine/lifecycle-conformance"
import { identifiedUserId } from "@voyant-travel/core"
import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/finance"
import {
  computePaymentSchedule,
  createOrReuseBookingSessionPayment,
  expirePendingBookingSessionPayments,
  financeService,
  findEstablishedBookingSessionPayment,
  hasInFlightBookingSessionPayment,
  initiateCheckoutCollection,
  noDepositPolicy,
  persistResolvedBookingPaymentSchedule,
  resolveEffectivePaymentPolicy,
  resolvePaymentCallbackUrl,
  startPaymentAdapterCardPayment,
  transferBookingSessionPaymentToBooking,
} from "@voyant-travel/finance"
import type { FinanceOperatorSettingsRuntime } from "@voyant-travel/finance/runtime-port"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  CatalogDistributionRuntimeExtension,
  CatalogInventoryRuntimeExtension,
} from "../runtime-contracts.js"
import { bookingsRef } from "./bookings-ref.js"
import type { BookingSessionPaymentPorts } from "./sessions-service.js"

export interface ProductionBookingSessionPaymentDeps {
  db: PostgresJsDatabase
  inventory: Pick<
    CatalogInventoryRuntimeExtension,
    "loadProductPaymentPolicyContext" | "resolveSelectedDepartureDate"
  >
  distribution: Pick<CatalogDistributionRuntimeExtension, "loadSupplierPaymentPolicy">
  settings: Pick<FinanceOperatorSettingsRuntime, "resolveOperatorDefaultPaymentPolicy"> &
    // Which document a bank transfer is collected against. Partial so a caller
    // that wires no invoicing settings keeps the historical proforma-first
    // behaviour rather than failing to construct.
    Partial<Pick<FinanceOperatorSettingsRuntime, "resolveInvoicingMode">>
  resolvePaymentAdapter?: () => PaymentAdapter | null | Promise<PaymentAdapter | null>
  paymentAdapterContext?: PaymentAdapterRuntimeContext
  financeRuntime?: Parameters<typeof createOrReuseBookingSessionPayment>[2]
  /**
   * Where the operator wants the transfer sent.
   *
   * Deployment-owned because it is operator profile and environment, not
   * catalog state. Returning null is the honest answer for an operator who has
   * configured no account, and it is what stops the engine issuing a document
   * that names nowhere to pay — a placeholder IBAN is worse than no
   * instructions, because it looks like an answer.
   */
  resolveBankTransferInstructions?: (db: PostgresJsDatabase) => Promise<{
    beneficiary: string
    iban: string
    bankName: string | null
  } | null>
  /**
   * Host override for bank-transfer document/instruction orchestration.
   *
   * Optional, and now genuinely optional: the ports below establish the
   * proforma and instructions themselves when it is absent. It was the ONLY
   * implementation until voyant#4743, and no deployment supplied it, so the
   * whole bank-transfer arm of Commit was a no-op that confirmed a Booking
   * owing its full price with nothing to pay it against.
   */
  establishBankTransfer?: BookingSessionPaymentPorts["establishBankTransfer"]
  /**
   * Whether the operator's booking terms authorize charging a stored
   * instrument while the shopper is away, and which revision says so.
   *
   * Absent, or resolving to null, means no instrument is stored. Fail closed
   * is the only safe default: the operator is the merchant of record and
   * carries the liability for an agreement they never wrote.
   */
  resolveStoredInstrumentMandate?: (
    db: PostgresJsDatabase,
  ) => Promise<{ enabled: boolean; revision: string } | null>
}

/**
 * What the shopper authorized, derived from the operator's terms and the
 * shopper's acceptance of them.
 *
 * Both halves are required and neither substitutes for the other. Terms that
 * carry the mandate authorize nothing until somebody accepts them, and an
 * acceptance authorizes nothing if the terms accepted never said it.
 *
 * `agreementReference` is the record. Card network rules ask the merchant to
 * keep one, and this is the handle that ties the stored instrument back to the
 * exact acceptance and terms revision it rests on. Without the revision an
 * acceptance says only that some terms were agreed at some point, which is not
 * evidence of anything.
 */
function storedInstrumentIntent(
  mandate: { enabled: boolean; revision: string } | null | undefined,
  session: { id: string; statePayload: Record<string, unknown> },
): { merchantInitiated: true; agreementReference: string } | undefined {
  if (!mandate?.enabled) return undefined
  const acceptance = record(session.statePayload.contractAcceptance)
  const acceptedAt = stringValue(acceptance?.acceptedAt)
  if (!acceptedAt || Number.isNaN(Date.parse(acceptedAt))) return undefined
  return {
    merchantInitiated: true,
    agreementReference: `booking-terms:${mandate.revision}:${session.id}:${acceptedAt}`,
  }
}

export function createProductionBookingSessionPaymentPorts(
  deps: ProductionBookingSessionPaymentDeps,
): BookingSessionPaymentPorts {
  return {
    async prepare({ session, quote, hold, commit, access, now }) {
      if (session.target.kind !== "product") return { kind: "not_required" }
      // An admitted staff workflow can establish its collection plan directly
      // on the atomic Booking command (including already-recorded offline
      // payments). That explicit schedule is the guarantee decision; do not
      // start a second customer checkout session alongside it.
      if (
        access.actorKind === "staff" &&
        access.staffBookingAuthority?.admitted &&
        hasStaffPaymentSchedule(session.statePayload)
      ) {
        return { kind: "not_required" }
      }
      // Bank transfer is a pay-later Commit path. Its durable document and
      // instructions are established once the Booking id exists, inside the
      // same Commit transaction, by `establishBankTransfer` below.
      if (commit.checkoutIntent === "bank_transfer") return { kind: "not_required" }

      // Anchored to the Quote's own instant, not Commit's.
      //
      // The deposit gate counts whole UTC days to departure, so a Quote taken
      // at 23:55 and committed at 00:02 measures one day less — and a
      // departure sitting exactly on `minDaysBeforeDepartureForDeposit`
      // advertises a deposit and then charges the full total. Payment policy
      // is outside the price fingerprint, so nothing rejects that Commit.
      //
      // `quotedAt` is what `describePlan` published from, and a Quote lives
      // for minutes, so this is never a stale anchor — it is the instant the
      // shopper was quoted at. It also stops the settlement re-check below
      // from spuriously failing on an amount that moved under it.
      //
      // This does not close the whole gap: an operator editing the policy
      // mid-session still changes the cascade, and only a fingerprinted or
      // persisted plan can reject that. See the PR discussion.
      const plan = await resolvePlan(deps, session, quote.pricing, quote.quotedAt)
      if (!plan) throw new Error("booking_session_payment_product_not_found")
      const { context, resolved, departureDate, entries } = plan
      const dueNow = entries[0]
      if (!dueNow || dueNow.amountCents <= 0) return { kind: "not_required" }

      const settlementPaymentSessionId = access.settlementAuthority?.paymentSessionId
      if (settlementPaymentSessionId) {
        const settled = await financeService.getPaymentSessionById(
          deps.db,
          settlementPaymentSessionId,
        )
        if (
          settled?.targetType !== "booking_session" ||
          settled.targetId !== session.id ||
          settled.amountCents !== dueNow.amountCents ||
          settled.currency !== dueNow.currency ||
          (settled.status !== "authorized" && settled.status !== "paid")
        ) {
          throw new Error("booking_session_settlement_payment_not_established")
        }
        return { kind: "established", paymentSessionId: settled.id }
      }

      const established = await findEstablishedBookingSessionPayment(deps.db, session.id, {
        amountCents: dueNow.amountCents,
        currency: dueNow.currency,
      })
      if (established) return { kind: "established", paymentSessionId: established.id }

      const contact = paymentContact(session.statePayload)
      let paymentSession = await createOrReuseBookingSessionPayment(
        deps.db,
        {
          bookingSessionId: session.id,
          commitIdempotencyKey: commit.idempotencyKey,
          amountCents: dueNow.amountCents,
          currency: dueNow.currency,
          payerEmail: contact.email,
          payerName: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
          returnUrl: commit.payment?.returnUrl,
          cancelUrl: commit.payment?.cancelUrl,
          expiresAt: earliestDate(
            session.expiresAt,
            quote.expiresAt,
            hold?.expiresAt ?? quote.expiresAt,
          ),
          metadata: {
            paymentPolicySource: resolved.source,
            paymentScheduleType: dueNow.scheduleType,
            sessionActorKind: session.actorKind,
            quoteId: quote.id,
            ...(hold ? { holdId: hold.id } : {}),
          },
        },
        deps.financeRuntime,
      )
      if (!paymentSession) throw new Error("booking_session_payment_creation_failed")

      if (paymentSession.status === "authorized" || paymentSession.status === "paid") {
        return { kind: "established", paymentSessionId: paymentSession.id }
      }

      const adapter = await deps.resolvePaymentAdapter?.()
      if (adapter && paymentSession.status === "pending") {
        const reference = customerReference(session)
        // Storage binds to the customer record, so an unidentified shopper
        // stores nothing however the terms read: there would be nobody for the
        // instrument to belong to.
        const storeInstrument = reference
          ? storedInstrumentIntent(await deps.resolveStoredInstrumentMandate?.(deps.db), session)
          : undefined
        await startPaymentAdapterCardPayment(
          adapter,
          {
            db: deps.db,
            sessionId: paymentSession.id,
            billing: {
              ...(contact.email ? { email: contact.email } : {}),
              ...(contact.firstName ? { firstName: contact.firstName } : {}),
              ...(contact.lastName ? { lastName: contact.lastName } : {}),
              ...(contact.phone ? { phone: contact.phone } : {}),
              ...(contact.country ? { country: contact.country } : {}),
              ...(contact.state ? { state: contact.state } : {}),
              ...(contact.city ? { city: contact.city } : {}),
              ...(contact.postalCode ? { postalCode: contact.postalCode } : {}),
              ...(contact.details ? { details: contact.details } : {}),
            },
            description: checkoutLineItem({
              productName: context.name,
              departureDate,
              locale: session.scope.locale,
            }),
            locale: session.scope.locale,
            ...(reference ? { customerReference: reference } : {}),
            ...(storeInstrument ? { storeInstrument } : {}),
            returnUrl: commit.payment?.returnUrl,
            cancelUrl: commit.payment?.cancelUrl,
            // Forwarded verbatim: the storefront is the only party that knows
            // what it can render, and nothing between it and the adapter is
            // entitled to decide on its behalf. Absent stays absent, which
            // `acceptedPaymentCheckoutHandoffs` reads as `["redirect"]`, and
            // an adapter without `embeddedCheckout` still answers with a
            // redirect through `negotiatePaymentCheckoutHandoff`
            // (voyant#4346). The parameter type is
            // `readonly PaymentCheckoutHandoff[]`, which is what pins the
            // contract's mirrored enum to the port.
            acceptedCheckoutHandoffs: commit.payment?.acceptedCheckoutHandoffs,
            metadata: {
              bookingSessionId: session.id,
              quoteId: quote.id,
              ...(hold ? { holdId: hold.id } : {}),
            },
          },
          {
            context: deps.paymentAdapterContext ?? { env: {} },
            runtime: deps.financeRuntime,
            notifyUrl: resolvePaymentCallbackUrl(deps.paymentAdapterContext?.env ?? {}),
          },
        )
        const refreshed = await financeService.getPaymentSessionById(deps.db, paymentSession.id)
        if (refreshed) paymentSession = refreshed
      }

      return {
        kind: "required",
        allowedGuarantees: ["deposit"],
        paymentSession: projectPaymentSession(paymentSession),
      }
    },
    async describePlan({ session, pricing, now }) {
      const plan = await resolvePlan(deps, session, pricing, now)
      // A target with no product, or a product that has since gone: the Quote
      // simply carries no plan. Commit throws on the same condition because it
      // is about to take money; a projection has nothing to protect.
      if (!plan) return null
      const [dueNow] = plan.entries
      if (!dueNow) return null
      return {
        policySource: plan.resolved.source,
        currency: pricing.currency,
        totalCents: pricing.total,
        dueNowCents: dueNow.amountCents,
        entries: plan.entries.map((entry) => ({
          scheduleType: entry.scheduleType,
          amountCents: entry.amountCents,
          currency: entry.currency,
          dueDate: entry.dueDate,
        })),
      }
    },
    async hasInFlight({ bookingSessionId }) {
      return hasInFlightBookingSessionPayment(deps.db, bookingSessionId)
    },
    async describeEstablished({ paymentSessionId }) {
      const session = await financeService.getPaymentSessionById(deps.db, paymentSessionId)
      if (!session) return null
      // Written by `prepare` above, into the same metadata the idempotency key
      // is derived from. Absent on a payment established before this was
      // recorded, which settlement reads as "no recorded Quote" and falls back.
      const metadata = session.metadata ?? {}
      return {
        quoteId: stringValue(metadata.quoteId),
        holdId: stringValue(metadata.holdId),
      }
    },
    async transferToBooking({ tx, ...input }) {
      await transferBookingSessionPaymentToBooking(tx as PostgresJsDatabase, input)
    },
    async expirePending({ tx, bookingSessionId, at }) {
      await expirePendingBookingSessionPayments(tx as PostgresJsDatabase, bookingSessionId, at)
    },
    async establishPaymentSchedule({ tx, session, quote, bookingId }) {
      await establishBookingPaymentSchedule(deps, tx as PostgresJsDatabase, {
        session,
        quotedAt: quote.quotedAt,
        bookingId,
      })
    },
    async establishBankTransfer(input) {
      if (deps.establishBankTransfer) return (await deps.establishBankTransfer(input)) ?? null
      return establishBankTransferDocument(deps, input.tx as PostgresJsDatabase, {
        bookingId: input.bookingId,
        bookingIds: input.bookingIds,
        now: input.now,
      })
    },
  }
}

/**
 * The Booking's own record of what it sold and when it departs.
 *
 * Read back rather than carried from the Quote: Finance reconciles tax and
 * extra lines while writing the Booking, so `sellAmountCents` is the number the
 * customer owes and the Quote total is not always it.
 */
async function readCommittedBooking(db: PostgresJsDatabase, bookingId: string) {
  const [booking] = await db
    .select({
      bookingNumber: bookingsRef.bookingNumber,
      sellAmountCents: bookingsRef.sellAmountCents,
      sellCurrency: bookingsRef.sellCurrency,
      startDate: bookingsRef.startDate,
    })
    .from(bookingsRef)
    .where(eq(bookingsRef.id, bookingId))
    .limit(1)
  return booking ?? null
}

/**
 * Persist the collection plan for a just-committed Booking (voyant#4743).
 *
 * The policy is resolved through the same cascade `prepare` and `describePlan`
 * use, anchored to the same `quotedAt`, so the rows written here state the
 * terms the shopper was quoted and accepted. Resolving it a second way at
 * Commit would put the stated terms and the recorded debt back on separate
 * derivations, which is the shape of voyant#4741.
 *
 * Silent no-ops, all of them deliberate:
 *
 * - **any schedule row already exists** — an admitted staff Commit states its
 *   own plan on the Booking command, and a replayed Commit finds the plan it
 *   wrote last time. Neither wants a second one.
 * - **no plan for the target** — a sourced or composite target has no product
 *   policy cascade to read. The `booking.confirmed` subscriber remains the
 *   safety net for those.
 * - **nothing owed** — a zero-total Booking has no schedule to state.
 */
async function establishBookingPaymentSchedule(
  deps: ProductionBookingSessionPaymentDeps,
  db: PostgresJsDatabase,
  input: {
    session: Parameters<typeof resolvePlan>[1]
    quotedAt: Date
    bookingId: string
  },
): Promise<void> {
  const existing = await financeService.listBookingPaymentSchedules(db, input.bookingId)
  if (existing.length > 0) return

  const booking = await readCommittedBooking(db, input.bookingId)
  if (!booking?.sellAmountCents || booking.sellAmountCents <= 0) return

  const plan = await resolvePlan(
    deps,
    input.session,
    { total: booking.sellAmountCents, currency: booking.sellCurrency },
    input.quotedAt,
  )
  if (!plan || plan.entries.length === 0) return

  // Finance's own write, so a Booking scheduled here is indistinguishable
  // downstream from one scheduled by the subscriber: the rows, the
  // `__payment_policy_source__` marker the contract resolver echoes, and the
  // activity entry the operator's payment-policy card reads to explain why
  // these terms apply. Writing only the rows would leave that card permanently
  // empty for the booking — the subscriber returns early once rows exist, so
  // nothing backfills it.
  await persistResolvedBookingPaymentSchedule(
    db,
    input.bookingId,
    { policy: plan.resolved.policy, source: plan.resolved.source, entries: plan.entries },
    {
      // Nothing to replace: this only runs when the Booking has no schedule.
      replace: false,
      description: `Payment schedule established at booking commit from ${plan.resolved.source} policy (${plan.entries.length} row${
        plan.entries.length === 1 ? "" : "s"
      })`,
    },
  )
}

/**
 * Issue the document a bank transfer is paid against, and say where to send it.
 *
 * Runs inside the Commit transaction, after the Booking and its schedule exist,
 * so a failure here rolls the Commit back rather than confirming a Booking the
 * shopper cannot pay.
 *
 * Finance owns every part of this: `initiateCheckoutCollection` selects the
 * next outstanding schedule row — the deposit, when the policy asks for one —
 * issues the proforma for exactly that amount with that row's due date, and
 * builds the instruction block. That is the same operation the operator's own
 * "collect by bank transfer" action performs, so the resulting document,
 * numbering, and settlement path are the ones the operator already knows.
 *
 * `ensureDefaultPaymentPlan` is off on purpose. Finance's fallback plan is a
 * fixed 30% / 30-days-before-departure default; inventing that here would
 * invoice terms no operator configured. When the schedule could not be
 * established the collection falls back to the Booking total, which is the
 * honest statement of what is owed.
 *
 * Null — no document, no instructions on the Commit outcome — in two cases:
 *
 * - **the operator has configured no account** to receive the transfer
 * - **the Commit confirmed more than one Booking.** A composite target commits
 *   one Booking per component and `BookingSessionBankTransferV1` carries a
 *   single document and a single instruction block, so anything established
 *   here would collect the primary component and silently strand the rest —
 *   while presenting the shopper an amount that reads like the whole trip.
 *   Partial collection dressed as complete is worse than none, so this stays
 *   exactly where it was before voyant#4743 until the outcome contract can
 *   state several collections, or a genuine aggregate document exists.
 */
async function establishBankTransferDocument(
  deps: ProductionBookingSessionPaymentDeps,
  db: PostgresJsDatabase,
  input: { bookingId: string; bookingIds: readonly string[]; now: Date },
): Promise<BookingSessionBankTransferV1 | null> {
  if (input.bookingIds.length > 1) return null

  const details = await deps.resolveBankTransferInstructions?.(db)
  if (!details) return null

  const booking = await readCommittedBooking(db, input.bookingId)
  if (!booking?.sellAmountCents || booking.sellAmountCents <= 0) return null

  // The operator's own invoicing mode, the same one the storefront checkout
  // reads: `direct` collects against the fiscal invoice, `proforma-first`
  // (the default) mints the invoice later, on settlement.
  const invoicingMode = await deps.settings.resolveInvoicingMode?.(db)

  const collection = await initiateCheckoutCollection(
    db,
    input.bookingId,
    { method: "bank_transfer", stage: "initial", ensureDefaultPaymentPlan: false },
    { defaultBankTransferDocumentType: invoicingMode === "direct" ? "invoice" : "proforma" },
    {
      bankTransferDetails: {
        provider: "bank-transfer",
        beneficiary: details.beneficiary,
        iban: details.iban,
        bankName: details.bankName,
      },
    },
  )
  const instructions = collection?.bankTransferInstructions
  if (!instructions || instructions.amountCents <= 0) return null

  return {
    paymentSessionId: collection?.paymentSession?.id ?? null,
    document: collection?.invoice
      ? {
          id: collection.invoice.id,
          number: collection.invoice.invoiceNumber,
          type: instructions.documentType,
        }
      : null,
    instructions: {
      beneficiary: instructions.beneficiary,
      iban: instructions.iban,
      bankName: instructions.bankName ?? null,
      // The document number, not the Booking reference: the balance is owed on
      // the proforma, and that is what the operator reconciles the incoming
      // transfer against.
      reference: instructions.invoiceNumber || `BOOK-${booking.bookingNumber}`,
      amountCents: instructions.amountCents,
      currency: instructions.currency,
      dueAt: instructions.dueDate ?? input.now.toISOString(),
    },
  }
}

/**
 * What the shopper is asked to pay for on the hosted checkout page.
 *
 * `description` is the only product-shaped field on `PaymentInitiationInput`,
 * so whatever is put here is the whole of what a provider can render — nothing
 * downstream can repair an identifier sent in its place. Names the product and,
 * where the target has one, its departure, in the Session's locale.
 *
 * Undefined when the product has no name: finance then falls back to the
 * payment session's own notes, which is still better than an id.
 */
function checkoutLineItem(input: {
  productName: string | null
  departureDate: string | null
  locale: string
}): string | undefined {
  const name = input.productName?.trim()
  if (!name) return undefined
  const departure = formatDepartureDate(input.departureDate, input.locale)
  return departure ? `${name} — ${departure}` : name
}

/**
 * Render a date-only departure in the Session's locale. The column is a plain
 * calendar date, so it is formatted in UTC — resolving it against the server's
 * zone would move it a day for a shopper west of the meridian.
 */
function formatDepartureDate(departureDate: string | null, locale: string): string | null {
  if (!departureDate) return null
  const parsed = new Date(`${departureDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(parsed)
  } catch {
    // An unparseable locale tag must not fail a checkout; the ISO date still
    // tells the shopper which departure they are paying for.
    return departureDate
  }
}

/**
 * The opaque, stable customer reference a hosted provider binds a stored
 * customer to. Prefers the CRM person the buyer was identified as; falls back
 * to the owning principal only for a customer-actor Session, because on a
 * staff-created Session the principal is the agent, not the shopper.
 *
 * The principal has to survive `identifiedUserId` first. A guest Session is
 * `actorKind: "customer"` with the anonymous placeholder as its principal, and
 * a reference is a *stable customer key* — the provider mints a Customer under
 * it on first use and matches every later checkout to that same record. Handing
 * over a value every guest shares therefore pools unrelated shoppers into one
 * Customer, keeping the first shopper's billing email on all of them
 * (voyant#4637). Absent is the correct answer: an anonymous shopper pays as a
 * guest, which is what the resolution contract asks for.
 */
function customerReference(session: {
  actorKind: string
  ownerPrincipalId?: string
  statePayload: Record<string, unknown>
}): string | undefined {
  const billing = record(session.statePayload.billing)
  const personId = stringValue(record(billing?.contact)?.personId)
  if (personId) return personId
  if (session.actorKind !== "customer") return undefined
  return identifiedUserId(session.ownerPrincipalId) ?? undefined
}

/**
 * The collection plan for a product Session, and everything that went into it.
 *
 * One derivation, two readers: `prepare` charges `entries[0]` at Commit and
 * `describePlan` publishes the whole thing on the Quote. Quoting a plan that a
 * second, parallel derivation produced would put the shopper's stated terms and
 * their actual charge back on separate code paths, which is the shape of
 * voyant#4741 rather than a fix for it.
 *
 * The policy cascade and the departure are two different questions about two
 * different things — the listing, and what the shopper selected off it. They
 * were one call until voyant#4740, which is how every deposit gate came to be
 * measured from `products.startDate`.
 *
 * Null when the product is gone. Callers differ on what that means: Commit
 * throws, a Quote projection publishes nothing.
 */
async function resolvePlan(
  deps: ProductionBookingSessionPaymentDeps,
  session: {
    target: { kind: string; productId?: string }
    scope: { locale: string }
    statePayload: Record<string, unknown>
  },
  pricing: { total: number; currency: string },
  /**
   * The instant the plan is measured from. Both callers pass the Quote's own
   * `quotedAt`, so the plan published on a Quote and the plan charged against
   * it are the same function of the same inputs.
   */
  asOf: Date,
) {
  const productId = session.target.productId
  if (session.target.kind !== "product" || !productId) return null
  const [context, departureDate] = await Promise.all([
    deps.inventory.loadProductPaymentPolicyContext(deps.db, productId, {
      locale: session.scope.locale,
    }),
    deps.inventory.resolveSelectedDepartureDate(deps.db, {
      productId,
      departureSlotId: selectedDepartureSlotId(session.statePayload),
    }),
  ])
  if (!context) return null
  const [supplierPolicy, operatorDefault] = await Promise.all([
    context.supplierId
      ? deps.distribution.loadSupplierPaymentPolicy(deps.db, context.supplierId)
      : Promise.resolve(null),
    deps.settings.resolveOperatorDefaultPaymentPolicy(deps.db),
  ])
  const resolved = resolveEffectivePaymentPolicy({
    listingPolicy: context.listingPolicy,
    categoryPolicy: context.categoryPolicy,
    supplierPolicy,
    operatorDefault: operatorDefault ?? noDepositPolicy,
  })
  const entries = computePaymentSchedule(
    {
      totalCents: pricing.total,
      currency: pricing.currency,
      departureDate,
      today: asOf,
    },
    resolved.policy,
  )
  return { context, resolved, departureDate, entries }
}

/**
 * Which departure the Session's selection names.
 *
 * The slot id and nothing else, read off the Session's own `configure` step —
 * the same place the Commit reads it from, and the only part of the selection
 * that reaches `bookings.startDate`. `configure.departureDate` sits right next
 * to it and is deliberately left behind: see `resolveSelectedDepartureDate`.
 */
function selectedDepartureSlotId(payload: Record<string, unknown>): string | null {
  return stringValue(record(payload.configure)?.departureSlotId)
}

function hasStaffPaymentSchedule(payload: Record<string, unknown>): boolean {
  const staffBooking = record(payload.staffBooking)
  return Array.isArray(staffBooking?.paymentSchedules) && staffBooking.paymentSchedules.length > 0
}

/**
 * What the Commit outcome says about the payment the shopper still owes.
 *
 * `checkout` is carried whole. `redirectUrl` is only the redirect arm's
 * flattened projection and is `null` for an embedded handoff, so a projection
 * that stopped at it would drop the client secret between the adapter and the
 * one outcome the storefront reads — the storefront having just been allowed to
 * ask for that arm at Commit (voyant#4346).
 */
function projectPaymentSession(session: {
  id: string
  status:
    | "pending"
    | "requires_redirect"
    | "processing"
    | "authorized"
    | "paid"
    | "failed"
    | "cancelled"
    | "expired"
  amountCents: number
  currency: string
  redirectUrl: string | null
  checkout?: BookingPaymentCheckoutV1 | null
  expiresAt: Date | null
}) {
  return {
    id: session.id,
    status: session.status,
    amountCents: session.amountCents,
    currency: session.currency,
    redirectUrl: session.redirectUrl,
    checkout: session.checkout ?? null,
    expiresAt: session.expiresAt?.toISOString() ?? null,
  }
}

function earliestDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())))
}

function paymentContact(payload: Record<string, unknown>) {
  const billing = record(payload.billing)
  const contact = record(billing?.contact)
  const address = record(billing?.address)
  return {
    firstName: stringValue(contact?.firstName),
    lastName: stringValue(contact?.lastName),
    email: stringValue(contact?.email),
    phone: stringValue(contact?.phone),
    country: stringValue(address?.country),
    // `CardPaymentBilling.state` — a processor that computes tax from the
    // billing address needs the subdivision, not just the country
    // (voyant#4290).
    state: stringValue(address?.region),
    city: stringValue(address?.city),
    postalCode: stringValue(address?.postal),
    details: stringValue(address?.line1),
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
