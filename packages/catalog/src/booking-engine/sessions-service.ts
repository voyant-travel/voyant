import { newId } from "@voyant-travel/db/lib/typeid"

import type {
  BookingHoldRecordV1,
  BookingLifecycleCommitOutcomeV1,
  BookingQuoteRecordV1,
  BookingSessionActorKindV1,
  BookingSessionOutcomeV1,
  BookingSessionRecordV1,
  BookingSessionTargetV1,
  CommitBookingSessionV1,
  CreateBookingSessionV1,
  PlaceBookingHoldV1,
  PricingBreakdownV1,
  QuoteBookingSessionV1,
  UpdateBookingSessionV1,
} from "./contracts.js"

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000
const DEFAULT_HOLD_TTL_MS = 15 * 60 * 1000

export interface BookingSessionInternalRecord {
  id: string
  capability?: string
  capabilityHash?: string
  target: BookingSessionTargetV1
  actorKind: BookingSessionActorKindV1
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

export interface BookingSessionRepository {
  createSession(record: BookingSessionInternalRecord): Promise<BookingSessionInternalRecord>
  getSession(sessionId: string): Promise<BookingSessionInternalRecord | null>
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
  now: Date
}

export interface BookingSessionModulePorts {
  repository: BookingSessionRepository
  composeQuote(input: ComposeBookingQuoteInput): Promise<PricingBreakdownV1>
  placeCapacityHold(input: {
    holdId: string
    capacityKey: string
    quantity: number
    expiresAt: Date
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
  createSession(input: CreateBookingSessionV1): Promise<BookingSessionOutcomeV1>
  updateSession(sessionId: string, input: UpdateBookingSessionV1): Promise<BookingSessionOutcomeV1>
  quoteSession(sessionId: string, input: QuoteBookingSessionV1): Promise<BookingSessionOutcomeV1>
  placeHold(sessionId: string, input: PlaceBookingHoldV1): Promise<BookingSessionOutcomeV1>
  commitSession(sessionId: string, input: CommitBookingSessionV1): Promise<BookingSessionOutcomeV1>
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
    async createSession(input) {
      const at = now()
      const capability =
        input.actorKind === "anonymous" || !input.actorKind ? issueCapability() : undefined
      const session: BookingSessionInternalRecord = {
        id: newId("booking_sessions"),
        capability,
        capabilityHash: capability ? await hashCapability(capability) : undefined,
        target: input.target,
        actorKind: input.actorKind ?? "anonymous",
        state: "active",
        revision: 1,
        statePayload: input.state ?? {},
        expiresAt: input.expiresAt
          ? new Date(input.expiresAt)
          : new Date(at.getTime() + (input.ttlMs ?? sessionTtlMs)),
        createdAt: at,
        updatedAt: at,
      }
      await repository.createSession(session)
      return { kind: "session_created", session: serializeSession(session) }
    },

    async updateSession(sessionId, input) {
      return repository.withSessionTransaction(sessionId, async () => {
        const session = await loadActiveSession(sessionId)
        if (!session) return { kind: "rejected", error: { kind: "session_expired" } }
        if (session.state === "expired")
          return { kind: "rejected", error: { kind: "session_expired" } }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        if (!(await hasSessionCapability(session, input.capability))) {
          return { kind: "rejected", error: { kind: "capability_required" } }
        }
        const revisionRejected = rejectRevision(input.expectedRevision, session.revision)
        if (revisionRejected) return revisionRejected

        const at = now()
        session.statePayload = input.state
        session.revision += 1
        session.updatedAt = at
        for (const quote of await repository.listActiveQuotes(session.id)) {
          quote.state = "superseded"
          await repository.saveQuote(quote)
        }
        await repository.saveSession(session)
        return { kind: "session_updated", session: serializeSession(session) }
      })
    },

    async quoteSession(sessionId, input) {
      return repository.withSessionTransaction(sessionId, async () => {
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        if (!(await hasSessionCapability(session, input.capability))) {
          return { kind: "rejected", error: { kind: "capability_required" } }
        }
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
        return {
          kind: "quote_created",
          session: serializeSession(session),
          quote: serializeQuote(quote),
        }
      })
    },

    async placeHold(sessionId, input) {
      return repository.withSessionTransaction(sessionId, async () => {
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        if (session.state === "consumed")
          return { kind: "rejected", error: { kind: "session_consumed" } }
        if (!(await hasSessionCapability(session, input.capability))) {
          return { kind: "rejected", error: { kind: "capability_required" } }
        }
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
          holdId: hold.id,
          capacityKey: hold.capacityKey,
          quantity: hold.quantity,
          expiresAt: hold.expiresAt,
          now: at,
        })
        if (held !== "held") {
          return {
            kind: "rejected",
            error: { kind: "availability_changed", nextAction: "request_new_hold" },
          }
        }
        await repository.saveHold(hold)
        return {
          kind: "hold_created",
          session: serializeSession(session),
          hold: serializeHold(hold),
        }
      })
    },

    async commitSession(sessionId, input) {
      return repository.withSessionTransaction(sessionId, async () => {
        const session = await loadActiveSession(sessionId)
        if (!session || session.state === "expired") {
          return { kind: "rejected", error: { kind: "session_expired" } }
        }
        if (!(await hasSessionCapability(session, input.capability))) {
          return { kind: "rejected", error: { kind: "capability_required" } }
        }

        const priorCommit = await repository.getCommitByIdempotency(sessionId, input.idempotencyKey)
        if (priorCommit) {
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

        const committed = await options.ports.commitOwnedBooking({
          session,
          quote,
          hold,
          idempotencyKey: input.idempotencyKey,
          now: at,
        })
        session.state = "consumed"
        session.updatedAt = at
        quote.state = "consumed"
        hold.state = "converted"
        await repository.saveSession(session)
        await repository.saveQuote(quote)
        await repository.saveHold(hold)

        const outcome: BookingLifecycleCommitOutcomeV1 = {
          kind: "committed",
          nextAction: "none",
          booking: { id: committed.bookingId, status: "confirmed" },
          allocationIds: committed.allocationIds,
          consumedSessionId: session.id,
          consumedQuoteId: quote.id,
          convertedHoldId: hold.id,
        }
        await repository.saveCommit({
          id: newId("booking_session_commits"),
          sessionId,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: stableFingerprint({
            expectedRevision: input.expectedRevision,
            quoteId: input.quoteId,
            holdId: input.holdId,
          }),
          outcome,
          bookingId: committed.bookingId,
          createdAt: at,
        })
        return { kind: "commit_result", outcome }
      })
    },
  }
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
    capability: session.capability,
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
  if (session.actorKind !== "anonymous") return true
  const expected = session.capabilityHash ?? session.capability
  if (!expected || !capability) return false
  return expected === capability || expected === (await hashCapability(capability))
}

async function hashCapability(capability: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(capability))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortForStableJson(value))
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
