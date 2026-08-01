import type {
  AbandonBookingSessionV1,
  BookingHoldRecordV1,
  BookingQuoteRecordV1,
  BookingSessionActorKindV1,
  BookingSessionOutcomeV1,
  BookingSessionRecordV1,
  BookingSessionTargetV1,
  CommitBookingSessionV1,
  CreateBookingSessionV1,
  PlaceBookingHoldV1,
  QuoteBookingSessionV1,
  UpdateBookingSessionV1,
} from "@voyant-travel/catalog-contracts/booking-engine/session-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import type { BookingLifecycleCommitOutcomeV1, PricingBreakdownV1 } from "./contracts.js"

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000
const DEFAULT_HOLD_TTL_MS = 15 * 60 * 1000

export interface BookingSessionInternalRecord {
  id: string
  createIdempotencyKey: string
  createRequestFingerprint: string
  capability?: string
  capabilityHash?: string
  target: BookingSessionTargetV1
  actorKind: BookingSessionActorKindV1
  ownerPrincipalId?: string
  ownerOrganizationId?: string
  state: "active" | "consumed" | "expired" | "abandoned"
  revision: number
  statePayload: Record<string, unknown>
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface BookingQuoteInternalRecord {
  id: string
  sessionId: string
  sessionRevision: number
  state: "active" | "superseded" | "consumed" | "expired"
  pricing: PricingBreakdownV1
  priceFingerprint: string
  quotedAt: Date
  expiresAt: Date
}

export interface BookingHoldInternalRecord {
  id: string
  sessionId: string
  quoteId: string
  target: BookingSessionTargetV1
  quantity: number
  state: "active" | "converted" | "released" | "expired"
  capacityKey: string
  expiresAt: Date
  createdAt: Date
}

export interface BookingCommitInternalRecord {
  id: string
  sessionId: string
  idempotencyKey: string
  requestFingerprint: string
  outcome: BookingLifecycleCommitOutcomeV1
  bookingId?: string
  createdAt: Date
}

export interface BookingSessionOperationRecord {
  id: string
  sessionId: string
  operation: "update" | "quote" | "hold" | "abandon"
  idempotencyKey: string
  requestFingerprint: string
  outcome?: BookingSessionOutcomeV1
  createdAt: Date
}

export type BookingSessionOperationClaim =
  | { status: "claimed"; id: string }
  | { status: "replay"; outcome: BookingSessionOutcomeV1 }
  | { status: "conflict" }

export interface BookingSessionRepository {
  createSession(record: BookingSessionInternalRecord): Promise<BookingSessionInternalRecord>
  getSession(sessionId: string): Promise<BookingSessionInternalRecord | null>
  getSessionByCreateIdempotency(
    idempotencyKey: string,
  ): Promise<BookingSessionInternalRecord | null>
  saveSession(record: BookingSessionInternalRecord): Promise<void>
  listActiveQuotes(sessionId: string): Promise<BookingQuoteInternalRecord[]>
  getQuote(quoteId: string): Promise<BookingQuoteInternalRecord | null>
  saveQuote(record: BookingQuoteInternalRecord): Promise<void>
  getHold(holdId: string): Promise<BookingHoldInternalRecord | null>
  saveHold(record: BookingHoldInternalRecord): Promise<void>
  getCommitByIdempotency(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<BookingCommitInternalRecord | null>
  saveCommit(record: BookingCommitInternalRecord): Promise<void>
  claimOperation(input: {
    id: string
    sessionId: string
    operation: BookingSessionOperationRecord["operation"]
    idempotencyKey: string
    requestFingerprint: string
    now: Date
  }): Promise<BookingSessionOperationClaim>
  completeOperation(input: { id: string; outcome: BookingSessionOutcomeV1 }): Promise<void>
  consumeCommit(input: {
    sessionId: string
    quoteId: string
    holdId: string
    idempotencyKey: string
    requestFingerprint: string
    outcome: BookingLifecycleCommitOutcomeV1
    bookingId: string
    now: Date
  }): Promise<void>
  withTransactionContext?<T>(tx: unknown, operation: () => Promise<T>): Promise<T>
  withSessionTransaction<T>(sessionId: string, operation: () => Promise<T>): Promise<T>
}

export interface ComposeBookingQuoteInput {
  session: BookingSessionInternalRecord
  now: Date
}

export interface CommitOwnedBookingInput {
  session: BookingSessionInternalRecord
  quote: BookingQuoteInternalRecord
  hold: BookingHoldInternalRecord
  idempotencyKey: string
  requestFingerprint: string
  access: BookingSessionAccessContext
  now: Date
  consumeSources(tx: unknown, bookingId: string, allocationIds: string[]): Promise<void>
}

export interface BookingSessionAccessContext {
  actorKind: BookingSessionActorKindV1
  principalId?: string
  organizationId?: string
  capability?: string
  sessionTtlMs?: number
}

export interface BookingSessionModulePorts {
  repository: BookingSessionRepository
  normalizeSelection(input: {
    target: BookingSessionTargetV1
    selection: Record<string, unknown>
    access: BookingSessionAccessContext
    now: Date
  }): Promise<Record<string, unknown>>
  composeQuote(input: ComposeBookingQuoteInput): Promise<PricingBreakdownV1>
  placeCapacityHold(input: {
    session: BookingSessionInternalRecord
    quote: BookingQuoteInternalRecord
    holdId: string
    capacityKey: string
    quantity: number
    expiresAt: Date
    access: BookingSessionAccessContext
    now: Date
  }): Promise<"held" | "unavailable">
  commitOwnedBooking(input: CommitOwnedBookingInput): Promise<{
    bookingId: string
    allocationIds: string[]
  }>
}

export interface BookingSessionModuleOptions {
  ports: BookingSessionModulePorts
  now?: () => Date
  sessionTtlMs?: number
  quoteTtlMs?: number
  holdTtlMs?: number
  issueCapability?: () => string
}

export interface BookingSessionModule {
  createSession(
    input: CreateBookingSessionV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
  updateSession(
    sessionId: string,
    input: UpdateBookingSessionV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
  quoteSession(
    sessionId: string,
    input: QuoteBookingSessionV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
  placeHold(
    sessionId: string,
    input: PlaceBookingHoldV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
  abandonSession(
    sessionId: string,
    input: AbandonBookingSessionV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
  commitSession(
    sessionId: string,
    input: CommitBookingSessionV1,
    access: BookingSessionAccessContext,
  ): Promise<BookingSessionOutcomeV1>
}

export function createBookingSessionModule(
  options: BookingSessionModuleOptions,
): BookingSessionModule {
  const now = options.now ?? (() => new Date())
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS
  const quoteTtlMs = options.quoteTtlMs ?? DEFAULT_QUOTE_TTL_MS
  const holdTtlMs = options.holdTtlMs ?? DEFAULT_HOLD_TTL_MS
  const issueCapability =
    options.issueCapability ?? (() => `bcap_${crypto.getRandomValues(new Uint32Array(4)).join("")}`)
  const { repository } = options.ports

  async function loadActiveSession(sessionId: string) {
    const session = await repository.getSession(sessionId)
    if (!session) return null
    const at = now()
    if (session.state === "active" && session.expiresAt <= at) {
      session.state = "expired"
      session.updatedAt = at
      await repository.saveSession(session)
    }
    return session
  }

  function rejectRevision(
    expectedRevision: number,
    actualRevision: number,
  ): BookingSessionOutcomeV1 | null {
    return expectedRevision === actualRevision
      ? null
      : {
          kind: "rejected",
          error: { kind: "revision_conflict", expectedRevision, actualRevision },
        }
  }

  return {
    async createSession(input, access) {
      const at = now()
      const createRequestFingerprint = stableFingerprint({
        actorKind: access.actorKind,
        principalId: access.principalId,
        organizationId: access.organizationId,
        target: input.target,
        selection: input.selection ?? {},
      })
      const existing = await repository.getSessionByCreateIdempotency(input.idempotencyKey)
      if (existing) {
        if (existing.createRequestFingerprint !== createRequestFingerprint) {
          return idempotencyConflict()
        }
        return { kind: "session_created", session: serializeSession(existing) }
      }
      const capability = access.actorKind === "anonymous" ? issueCapability() : undefined
      const statePayload = await options.ports.normalizeSelection({
        target: input.target,
        selection: input.selection ?? {},
        access,
        now: at,
      })
      const session: BookingSessionInternalRecord = {
        id: newId("booking_sessions"),
        createIdempotencyKey: input.idempotencyKey,
        createRequestFingerprint,
        capability,
        capabilityHash: capability ? await hashCapability(capability) : undefined,
        target: input.target,
        actorKind: access.actorKind,
        ownerPrincipalId: access.principalId,
        ownerOrganizationId: access.organizationId,
        state: "active",
        revision: 1,
        statePayload,
        expiresAt: new Date(at.getTime() + (access.sessionTtlMs ?? sessionTtlMs)),
        createdAt: at,
        updatedAt: at,
      }
      await repository.createSession(session)
      return {
        kind: "session_created",
        session: serializeSession(session),
        ...(capability
          ? {
              capability: {
                token: capability,
                transport: "header" as const,
                headerName: "Voyant-Booking-Session-Capability" as const,
              },
            }
          : {}),
      }
    },

    async updateSession(sessionId, input, access) {
      return repository.withSessionTransaction(sessionId, async () => {
        const claim = await claimOperation(repository, sessionId, "update", input, now())
        if (claim.status === "replay") return claim.outcome
        if (claim.status === "conflict") return idempotencyConflict()
        const session = await loadActiveSession(sessionId)
        if (!session) return { kind: "rejected", error: { kind: "session_expired" } }
        if (session.state === "expired")
          return { kind: "rejected", error: { kind: "session_expired" } }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        const authorized = await authorizeSessionAccess(session, access)
        if (authorized) return authorized
        const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
        if (revisionRejected) return revisionRejected

        const at = now()
        session.statePayload = await options.ports.normalizeSelection({
          target: session.target,
          selection: input.selection,
          access,
          now: at,
        })
        session.revision += 1
        session.updatedAt = at
        for (const quote of await repository.listActiveQuotes(session.id)) {
          quote.state = "superseded"
          await repository.saveQuote(quote)
        }
        await repository.saveSession(session)
        const outcome: BookingSessionOutcomeV1 = {
          kind: "session_updated",
          session: serializeSession(session),
        }
        await repository.completeOperation({ id: claim.id, outcome })
        return outcome
      })
    },

    async quoteSession(sessionId, input, access) {
      return repository.withSessionTransaction(sessionId, async () => {
        const claim = await claimOperation(repository, sessionId, "quote", input, now())
        if (claim.status === "replay") return claim.outcome
        if (claim.status === "conflict") return idempotencyConflict()
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        const authorized = await authorizeSessionAccess(session, access)
        if (authorized) return authorized
        const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
        if (revisionRejected) return revisionRejected

        const at = now()
        for (const quote of await repository.listActiveQuotes(session.id)) {
          quote.state = "superseded"
          await repository.saveQuote(quote)
        }

        const pricing = await options.ports.composeQuote({ session, now: at })
        const quote: BookingQuoteInternalRecord = {
          id: newId("booking_session_quotes"),
          sessionId,
          sessionRevision: session.revision,
          state: "active",
          pricing,
          priceFingerprint: stableFingerprint(pricing),
          quotedAt: at,
          expiresAt: new Date(at.getTime() + quoteTtlMs),
        }
        await repository.saveQuote(quote)
        const outcome: BookingSessionOutcomeV1 = {
          kind: "quote_created",
          session: serializeSession(session),
          quote: serializeQuote(quote),
        }
        await repository.completeOperation({ id: claim.id, outcome })
        return outcome
      })
    },

    async placeHold(sessionId, input, access) {
      return repository.withSessionTransaction(sessionId, async () => {
        const claim = await claimOperation(repository, sessionId, "hold", input, now())
        if (claim.status === "replay") return claim.outcome
        if (claim.status === "conflict") return idempotencyConflict()
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        const authorized = await authorizeSessionAccess(session, access)
        if (authorized) return authorized
        const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
        if (revisionRejected) return revisionRejected

        const quote = await loadUsableQuote(repository, input.quoteId, session, now())
        if (quote === "expired") {
          return {
            kind: "rejected",
            error: { kind: "quote_expired", nextAction: "request_fresh_quote" },
          }
        }
        if (quote === "superseded") {
          return {
            kind: "rejected",
            error: { kind: "quote_superseded", nextAction: "request_fresh_quote" },
          }
        }
        if (!quote) {
          return {
            kind: "rejected",
            error: { kind: "quote_required", nextAction: "request_fresh_quote" },
          }
        }

        const at = now()
        const hold: BookingHoldInternalRecord = {
          id: newId("booking_session_holds"),
          sessionId,
          quoteId: quote.id,
          target: session.target,
          quantity: input.quantity ?? 1,
          state: "active",
          capacityKey: capacityKeyForTarget(session.target),
          expiresAt: new Date(at.getTime() + holdTtlMs),
          createdAt: at,
        }
        const held = await options.ports.placeCapacityHold({
          session,
          quote,
          holdId: hold.id,
          capacityKey: hold.capacityKey,
          quantity: hold.quantity,
          expiresAt: hold.expiresAt,
          access,
          now: at,
        })
        if (held !== "held") {
          return {
            kind: "rejected",
            error: { kind: "availability_changed", nextAction: "request_new_hold" },
          }
        }
        await repository.saveHold(hold)
        const outcome: BookingSessionOutcomeV1 = {
          kind: "hold_created",
          session: serializeSession(session),
          hold: serializeHold(hold),
        }
        await repository.completeOperation({ id: claim.id, outcome })
        return outcome
      })
    },

    async abandonSession(sessionId, input, access) {
      return repository.withSessionTransaction(sessionId, async () => {
        const claim = await claimOperation(repository, sessionId, "abandon", input, now())
        if (claim.status === "replay") return claim.outcome
        if (claim.status === "conflict") return idempotencyConflict()
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        const authorized = await authorizeSessionAccess(session, access)
        if (authorized) return authorized
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
        if (revisionRejected) return revisionRejected

        const at = now()
        session.state = "abandoned"
        session.updatedAt = at
        for (const quote of await repository.listActiveQuotes(session.id)) {
          quote.state = "superseded"
          await repository.saveQuote(quote)
        }
        await repository.saveSession(session)
        const outcome: BookingSessionOutcomeV1 = {
          kind: "session_abandoned",
          session: serializeSession(session),
        }
        await repository.completeOperation({ id: claim.id, outcome })
        return outcome
      })
    },

    async commitSession(sessionId, input, access) {
      const session = await loadActiveSession(sessionId)
      if (!session || session.state === "expired") {
        return { kind: "rejected", error: { kind: "session_expired" } }
      }
      const authorized = await authorizeSessionAccess(session, access)
      if (authorized) return authorized

      const priorCommit = await repository.getCommitByIdempotency(sessionId, input.idempotencyKey)
      if (priorCommit) {
        const requestFingerprint = commitRequestFingerprint(input)
        if (priorCommit.requestFingerprint !== requestFingerprint) return idempotencyConflict()
        return {
          kind: "commit_result",
          outcome: {
            kind: "idempotent_replay",
            nextAction: "return_idempotent_result",
            originalCommitId: priorCommit.id,
            equivalentToOutcome: "committed",
            bookingId: priorCommit.bookingId,
          },
        }
      }

      if (session.state === "consumed") {
        return {
          kind: "rejected",
          error: { kind: "commit_already_consumed", nextAction: "return_idempotent_result" },
        }
      }
      const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
      if (revisionRejected) return revisionRejected

      const at = now()
      const quote = await loadUsableQuote(repository, input.quoteId, session, at)
      if (quote === "expired") {
        return {
          kind: "commit_result",
          outcome: {
            kind: "quote_failure",
            nextAction: "request_fresh_quote",
            reason: "expired",
          },
        }
      }
      if (quote === "superseded") {
        return {
          kind: "commit_result",
          outcome: {
            kind: "quote_failure",
            nextAction: "request_fresh_quote",
            reason: "superseded",
          },
        }
      }
      if (!quote) {
        const latestSession = await repository.getSession(sessionId)
        if (latestSession?.state === "consumed") {
          return {
            kind: "rejected",
            error: { kind: "commit_already_consumed", nextAction: "return_idempotent_result" },
          }
        }
        return {
          kind: "commit_result",
          outcome: {
            kind: "quote_failure",
            nextAction: "request_fresh_quote",
            reason: "mismatched_session",
          },
        }
      }

      const hold = await loadUsableHold(repository, input.holdId, session, quote, at)
      if (hold === "expired") {
        return {
          kind: "commit_result",
          outcome: { kind: "hold_failure", nextAction: "request_new_hold", reason: "expired" },
        }
      }
      if (!hold) {
        return {
          kind: "commit_result",
          outcome: { kind: "hold_failure", nextAction: "request_new_hold", reason: "missing" },
        }
      }

      const freshPricing = await options.ports.composeQuote({ session, now: at })
      if (stableFingerprint(freshPricing) !== quote.priceFingerprint) {
        quote.state = "superseded"
        await repository.saveQuote(quote)
        return {
          kind: "commit_result",
          outcome: {
            kind: "quote_failure",
            nextAction: "request_fresh_quote",
            reason: "superseded",
          },
        }
      }

      const requestFingerprint = commitRequestFingerprint(input)
      let committed: { bookingId: string; allocationIds: string[] }
      try {
        committed = await options.ports.commitOwnedBooking({
          session,
          quote,
          hold,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint,
          access,
          now: at,
          async consumeSources(tx, bookingId, allocationIds) {
            const outcome: BookingLifecycleCommitOutcomeV1 = {
              kind: "committed",
              nextAction: "none",
              booking: { id: bookingId, status: "confirmed" },
              allocationIds,
              consumedSessionId: session.id,
              consumedQuoteId: quote.id,
              convertedHoldId: hold.id,
            }
            await withRepositoryTransactionContext(repository, tx, () =>
              repository.consumeCommit({
                sessionId,
                quoteId: quote.id,
                holdId: hold.id,
                idempotencyKey: input.idempotencyKey,
                requestFingerprint,
                outcome,
                bookingId,
                now: at,
              }),
            )
          },
        })
      } catch (error) {
        if (isIdempotencyConflictError(error)) return idempotencyConflict()
        if (isCommitConsumedError(error)) {
          return {
            kind: "rejected",
            error: { kind: "commit_already_consumed", nextAction: "return_idempotent_result" },
          }
        }
        throw error
      }
      const outcome: BookingLifecycleCommitOutcomeV1 = {
        kind: "committed",
        nextAction: "none",
        booking: { id: committed.bookingId, status: "confirmed" },
        allocationIds: committed.allocationIds,
        consumedSessionId: session.id,
        consumedQuoteId: quote.id,
        convertedHoldId: hold.id,
      }
      return { kind: "commit_result", outcome }
    },
  }
}

function withRepositoryTransactionContext<T>(
  repository: BookingSessionRepository,
  tx: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  return repository.withTransactionContext
    ? repository.withTransactionContext(tx, operation)
    : operation()
}

async function claimOperation(
  repository: BookingSessionRepository,
  sessionId: string,
  operation: BookingSessionOperationRecord["operation"],
  input: unknown,
  now: Date,
): Promise<BookingSessionOperationClaim> {
  return repository.claimOperation({
    id: newId("booking_session_operations"),
    sessionId,
    operation,
    idempotencyKey: idempotencyKeyFromInput(input),
    requestFingerprint: stableFingerprint(input),
    now,
  })
}

function idempotencyKeyFromInput(input: unknown): string {
  if (!input || typeof input !== "object") return ""
  const value = Reflect.get(input, "idempotencyKey")
  return typeof value === "string" ? value : ""
}

function commitRequestFingerprint(input: CommitBookingSessionV1): string {
  return stableFingerprint({
    expectedRevision: input.expectedRevision,
    quoteId: input.quoteId,
    holdId: input.holdId,
  })
}

function idempotencyConflict(): BookingSessionOutcomeV1 {
  return { kind: "rejected", error: { kind: "idempotency_conflict" } }
}

function isIdempotencyConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ActionLedgerIdempotencyConflictError" ||
      error.message.includes("idempotency_conflict"))
  )
}

function isCommitConsumedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "booking_session_commit_session_consumed" ||
      error.message === "booking_session_commit_quote_consumed" ||
      error.message === "booking_session_commit_hold_consumed" ||
      error.message === "owned inventory hold is not live at commit")
  )
}

async function loadUsableQuote(
  repository: BookingSessionRepository,
  quoteId: string,
  session: BookingSessionInternalRecord,
  now: Date,
): Promise<BookingQuoteInternalRecord | "expired" | "superseded" | null> {
  const quote = await repository.getQuote(quoteId)
  if (!quote || quote.sessionId !== session.id) return null
  if (quote.state === "superseded") return "superseded"
  if (quote.sessionRevision !== session.revision) return null
  if (quote.state !== "active") return quote.state === "expired" ? "expired" : null
  if (quote.expiresAt <= now) {
    quote.state = "expired"
    await repository.saveQuote(quote)
    return "expired"
  }
  return quote
}

async function loadUsableHold(
  repository: BookingSessionRepository,
  holdId: string,
  session: BookingSessionInternalRecord,
  quote: BookingQuoteInternalRecord,
  now: Date,
): Promise<BookingHoldInternalRecord | "expired" | null> {
  const hold = await repository.getHold(holdId)
  if (!hold || hold.sessionId !== session.id || hold.quoteId !== quote.id) return null
  if (hold.state !== "active") return hold.state === "expired" ? "expired" : null
  if (hold.expiresAt <= now) {
    hold.state = "expired"
    await repository.saveHold(hold)
    return "expired"
  }
  return hold
}

function capacityKeyForTarget(target: BookingSessionTargetV1): string {
  if (target.kind === "product" && target.productId) return `product:${target.productId}`
  if (target.kind === "catalog_item" && target.catalogItemId)
    return `catalog_item:${target.catalogItemId}`
  return stableFingerprint(target)
}

function serializeSession(session: BookingSessionInternalRecord): BookingSessionRecordV1 {
  return {
    id: session.id,
    target: session.target,
    actorKind: session.actorKind,
    state: session.state,
    revision: session.revision,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

function serializeQuote(quote: BookingQuoteInternalRecord): BookingQuoteRecordV1 {
  return {
    id: quote.id,
    sessionId: quote.sessionId,
    sessionRevision: quote.sessionRevision,
    state: quote.state,
    pricing: quote.pricing,
    quotedAt: quote.quotedAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
  }
}

function serializeHold(hold: BookingHoldInternalRecord): BookingHoldRecordV1 {
  return {
    id: hold.id,
    sessionId: hold.sessionId,
    quoteId: hold.quoteId,
    target: hold.target,
    quantity: hold.quantity,
    state: hold.state,
    expiresAt: hold.expiresAt.toISOString(),
    createdAt: hold.createdAt.toISOString(),
  }
}

async function hasSessionCapability(
  session: BookingSessionInternalRecord,
  capability: string | undefined,
): Promise<boolean> {
  const expected = session.capabilityHash ?? session.capability
  if (!expected || !capability) return false
  return (
    constantTimeEqual(expected, capability) ||
    constantTimeEqual(expected, await hashCapability(capability))
  )
}

async function authorizeSessionAccess(
  session: BookingSessionInternalRecord,
  access: BookingSessionAccessContext,
): Promise<BookingSessionOutcomeV1 | null> {
  if (session.actorKind === "anonymous") {
    return (await hasSessionCapability(session, access.capability))
      ? null
      : { kind: "rejected", error: { kind: "capability_required" } }
  }
  if (access.actorKind !== session.actorKind) {
    return { kind: "rejected", error: { kind: "not_authorized" } }
  }
  if (session.ownerPrincipalId && session.ownerPrincipalId !== access.principalId) {
    return { kind: "rejected", error: { kind: "not_authorized" } }
  }
  if (session.ownerOrganizationId && session.ownerOrganizationId !== access.organizationId) {
    return { kind: "rejected", error: { kind: "not_authorized" } }
  }
  return null
}

async function hashCapability(capability: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(capability))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortForStableJson(value))
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return diff === 0
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableJson)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortForStableJson(item)]),
  )
}
