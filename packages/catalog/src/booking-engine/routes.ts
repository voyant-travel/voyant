import type { AnyDrizzleDb } from "@voyantjs/db"
import { handleApiError, parseJsonBody, RequestValidationError } from "@voyantjs/hono"
import type { HonoModule } from "@voyantjs/hono/module"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"

import type { SourceAdapterContext } from "../adapter/contract.js"
import { readSourcedEntry } from "../services/sourced-entry-service.js"
import type { PricingBasis } from "../snapshot/schema.js"

import { type BookEntityResult, bookEntity } from "./book.js"
import {
  type BookResponseV1,
  bookResponseV1,
  type PricingBreakdownV1,
  type QuoteResponseV1,
  quoteResponseV1,
} from "./contracts.js"
import {
  createBookingDraft,
  DEFAULT_DRAFT_TTL_MS,
  deleteBookingDraft,
  getBookingDraft,
  markDraftConsumed,
  updateBookingDraft,
} from "./drafts-service.js"
import {
  BookingEngineError,
  NO_ADAPTER_REGISTERED,
  NO_HANDLER_REGISTERED,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  RESERVE_FAILED,
} from "./errors.js"
import { OWNED_SOURCE_KIND, type OwnedBookingHandlerRegistry } from "./owned-handler.js"
import { type QuoteEntityDeps, type QuoteEntityResult, quoteEntity } from "./quote.js"
import type { SourceAdapterRegistry } from "./registry.js"
import type { SnapshotContentCapturer } from "./snapshot-content.js"

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000

const recordSchema = z.record(z.string(), z.unknown())

const quoteScopeSchema = z
  .object({
    locale: z.string().min(1).optional(),
    audience: z.enum(["staff", "customer", "partner", "supplier"]).optional(),
    market: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
  })
  .optional()

const quoteBodySchema = z.object({
  entityModule: z.string().min(1),
  entityId: z.string().min(1),
  sourceKind: z.string().min(1).optional(),
  sourceProvider: z.string().min(1).optional(),
  sourceConnectionId: z.string().min(1).optional(),
  sourceRef: z.string().min(1).optional(),
  scope: quoteScopeSchema,
  parameters: recordSchema.optional(),
  draft: recordSchema.optional(),
  ttlMs: z.number().int().positive().optional(),
})

const bookBodySchema = z
  .object({
    quoteId: z.string().min(1).optional(),
    bookingId: z.string().min(1).optional(),
    party: recordSchema.optional(),
    paymentIntent: z
      .union([
        z.object({ type: z.literal("hold") }),
        z.object({ type: z.literal("card"), tokenizedCard: z.string().min(1) }),
        z.object({ type: z.literal("ticket_on_credit"), agencyAccount: z.string().min(1) }),
      ])
      .optional(),
    parameters: recordSchema.optional(),
    draftId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((body) => body.quoteId || body.draftId, {
    message: "either quoteId or draftId is required",
  })

const draftBodySchema = z.object({
  entityModule: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  sourceKind: z.string().min(1).optional(),
  sourceConnectionId: z.string().min(1).optional(),
  sourceRef: z.string().min(1).optional(),
  draftPayload: recordSchema,
  currentStep: z.string().min(1).optional(),
  currentQuoteId: z.string().min(1).optional(),
  ttlMs: z.number().int().positive().optional(),
})

const holdPlaceBodySchema = z.object({
  entityModule: z.string().min(1),
  entityId: z.string().min(1),
  draftId: z.string().min(1),
  ttlMs: z.number().int().positive().optional(),
  parameters: recordSchema.optional(),
})

const holdReleaseBodySchema = z.object({
  entityModule: z.string().min(1),
  holdToken: z.string().min(1),
})

export type CatalogBookingQuoteBody = z.infer<typeof quoteBodySchema>
export type CatalogBookingBookBody = z.infer<typeof bookBodySchema>
export type CatalogBookingDraftBody = z.infer<typeof draftBodySchema>
export type CatalogBookingHoldPlaceBody = z.infer<typeof holdPlaceBodySchema>
export type CatalogBookingHoldReleaseBody = z.infer<typeof holdReleaseBodySchema>

export interface CatalogBookingProvenance {
  sourceKind: string
  sourceProvider?: string
  sourceConnectionId?: string
  sourceRef?: string
}

export interface CatalogBookingProvenanceInput {
  c: Context
  db: AnyDrizzleDb
  entityModule: string
  entityId: string
}

export interface CatalogBookingAdapterContextInput {
  c: Context
  db: AnyDrizzleDb
  operation: "quote" | "book" | "hold"
  entityModule?: string
  entityId?: string
  sourceKind: string
  sourceConnectionId?: string
  correlationId: string
}

export interface CatalogBookingHoldTtlInput {
  c: Context
  db: AnyDrizzleDb
  entityModule: string
  entityId: string
}

export interface CatalogBookingContentScopeInput {
  c: Context
  db: AnyDrizzleDb
  body: CatalogBookingBookBody
  draftPayload?: Record<string, unknown>
}

export interface CatalogBookingQuoteTransformInput {
  c: Context
  db: AnyDrizzleDb
  request: CatalogBookingQuoteBody
  provenance: CatalogBookingProvenance
  result: QuoteEntityResult
}

export interface CatalogBookingBookTransformInput {
  c: Context
  db: AnyDrizzleDb
  request: CatalogBookingBookBody
  result: BookEntityResult
}

export interface CatalogBookingDraftConsumedError {
  c: Context
  db: AnyDrizzleDb
  draftId: string
  bookingId: string
  error: unknown
}

export interface CatalogBookingCommittedEvent {
  c: Context
  db: AnyDrizzleDb
  request: CatalogBookingBookBody
  result: BookEntityResult
}

export interface CatalogBookingRoutesOptions {
  resolveDb(c: Context): AnyDrizzleDb
  resolveSourceRegistry(c: Context): SourceAdapterRegistry
  resolveOwnedHandlers?(c: Context): OwnedBookingHandlerRegistry | undefined
  resolveActorId?(c: Context): string | null
  resolveCorrelationId?(c: Context): string
  resolveAdapterContext?(input: CatalogBookingAdapterContextInput): SourceAdapterContext
  resolveEntityProvenance?(input: CatalogBookingProvenanceInput): Promise<CatalogBookingProvenance>
  resolveHoldTtlMs?(input: CatalogBookingHoldTtlInput): Promise<number>
  resolveContentScope?(input: CatalogBookingContentScopeInput):
    | {
        locale: string
        market?: string
        currency?: string
      }
    | undefined
  contentEnricher?: QuoteEntityDeps["contentEnricher"]
  onContentEnricherError?: QuoteEntityDeps["onEnricherError"]
  /**
   * Resolve a per-request `evaluatePromotions` hook. Returning `undefined`
   * skips promotion evaluation. Templates typically wire
   * `createCatalogPromotionEvaluator(db)` from `@voyantjs/promotions`.
   *
   * Per docs/architecture/promotions-architecture.md §3.6 + §7.1.
   */
  resolveEvaluatePromotions?(input: {
    c: Context
    db: AnyDrizzleDb
  }): QuoteEntityDeps["evaluatePromotions"]
  captureSnapshotContent?: SnapshotContentCapturer
  transformQuoteResult?(input: CatalogBookingQuoteTransformInput): Promise<QuoteEntityResult>
  transformBookResult?(input: CatalogBookingBookTransformInput): Promise<BookEntityResult>
  onDraftConsumedError?(event: CatalogBookingDraftConsumedError): void
  onCommitted?(event: CatalogBookingCommittedEvent): Promise<void> | void
}

export function createCatalogBookingRoutes(options: CatalogBookingRoutesOptions): Hono {
  return new Hono()
    .post("/quote", async (c) => handleQuote(c, options))
    .post("/book", async (c) => handleBook(c, options))
    .put("/drafts/:id", async (c) => handleDraftPut(c, options))
    .get("/drafts/:id", async (c) => handleDraftGet(c, options))
    .delete("/drafts/:id", async (c) => handleDraftDelete(c, options))
    .post("/holds/place", async (c) => handleHoldPlace(c, options))
    .post("/holds/release", async (c) => handleHoldRelease(c, options))
}

export function createCatalogBookingHonoModule(options: CatalogBookingRoutesOptions): HonoModule {
  return {
    module: { name: "catalog" },
    adminRoutes: createCatalogBookingRoutes(options),
    publicRoutes: createCatalogBookingRoutes(options),
  }
}

async function handleQuote(c: Context, options: CatalogBookingRoutesOptions): Promise<Response> {
  const body = await parseJsonBody(c, quoteBodySchema)
  const db = options.resolveDb(c)
  const provenance = body.sourceKind
    ? {
        sourceKind: body.sourceKind,
        sourceProvider: body.sourceProvider,
        sourceConnectionId: body.sourceConnectionId,
        sourceRef: body.sourceRef,
      }
    : await resolveEntityProvenance(c, options, db, body.entityModule, body.entityId)
  const correlationId = resolveCorrelationId(c, options)
  const adapterContext = resolveAdapterContext(c, options, {
    db,
    operation: "quote",
    entityModule: body.entityModule,
    entityId: body.entityId,
    sourceKind: provenance.sourceKind,
    sourceConnectionId: provenance.sourceConnectionId,
    correlationId,
  })

  try {
    const result = await quoteEntity(
      db,
      {
        registry: options.resolveSourceRegistry(c),
        ownedHandlers: options.resolveOwnedHandlers?.(c),
        contentEnricher: options.contentEnricher,
        onEnricherError: options.onContentEnricherError,
        evaluatePromotions: options.resolveEvaluatePromotions?.({ c, db }),
      },
      {
        entityModule: body.entityModule,
        entityId: body.entityId,
        sourceKind: provenance.sourceKind,
        sourceProvider: provenance.sourceProvider,
        sourceConnectionId: provenance.sourceConnectionId,
        sourceRef: provenance.sourceRef,
        scope: {
          locale: body.scope?.locale ?? "en-GB",
          audience: body.scope?.audience ?? defaultAudienceForPath(c),
          market: body.scope?.market ?? "default",
          currency: body.scope?.currency,
        },
        parameters: engineParametersFromDraft(body.parameters, body.draft),
        ttlMs: body.ttlMs,
        adapterContext,
      },
    )
    const transformed =
      (await options.transformQuoteResult?.({ c, db, request: body, provenance, result })) ?? result
    return c.json(serializeQuoteResult(transformed))
  } catch (err) {
    return bookingEngineErrorResponse(c, err)
  }
}

async function handleBook(c: Context, options: CatalogBookingRoutesOptions): Promise<Response> {
  const body = await parseJsonBody(c, bookBodySchema)
  const db = options.resolveDb(c)
  const correlationId = resolveCorrelationId(c, options)

  let quoteId = body.quoteId
  let draftPayload: Record<string, unknown> | undefined
  if (!quoteId && body.draftId) {
    const draft = await getBookingDraft(db, body.draftId)
    if (!draft) {
      return c.json({ error: "draft not found" }, 404)
    }
    if (!draft.current_quote_id) {
      return c.json({ error: "draft has no current quote - call /quote first" }, 409)
    }
    quoteId = draft.current_quote_id
    draftPayload = draft.draft_payload
  }
  if (!quoteId) {
    return c.json({ error: "quoteId could not be resolved" }, 400)
  }

  try {
    const adapterContext = resolveAdapterContext(c, options, {
      db,
      operation: "book",
      sourceKind: "engine",
      correlationId,
    })
    const result = await bookEntity(
      db,
      {
        registry: options.resolveSourceRegistry(c),
        ownedHandlers: options.resolveOwnedHandlers?.(c),
        captureSnapshotContent: options.captureSnapshotContent,
      },
      {
        quoteId,
        bookingId: body.bookingId,
        party: body.party,
        paymentIntent: body.paymentIntent,
        parameters: engineParametersFromDraft(
          body.parameters,
          draftPayload ?? body.parameters?.draft,
        ),
        idempotencyKey: body.idempotencyKey,
        adapterContext,
        contentScope: options.resolveContentScope?.({ c, db, body, draftPayload }),
      },
    )

    if (body.draftId) {
      try {
        await markDraftConsumed(db, body.draftId, result.bookingId)
      } catch (error) {
        options.onDraftConsumedError?.({
          c,
          db,
          draftId: body.draftId,
          bookingId: result.bookingId,
          error,
        })
      }
    }

    await options.onCommitted?.({ c, db, request: body, result })
    const transformed =
      (await options.transformBookResult?.({ c, db, request: body, result })) ?? result
    return c.json(serializeBookResult(transformed))
  } catch (err) {
    return bookingEngineErrorResponse(c, err)
  }
}

async function handleDraftPut(c: Context, options: CatalogBookingRoutesOptions): Promise<Response> {
  const id = c.req.param("id")
  if (!id) throw new RequestValidationError("id is required")

  const body = await parseJsonBody(c, draftBodySchema)
  const db = options.resolveDb(c)
  const existing = await getBookingDraft(db, id)
  if (existing) {
    const updated = await updateBookingDraft(db, id, {
      draftPayload: body.draftPayload,
      currentStep: body.currentStep,
      currentQuoteId: body.currentQuoteId,
      refreshTtlMs: body.ttlMs ?? DEFAULT_DRAFT_TTL_MS,
    })
    return c.json(updated)
  }

  if (!body.entityModule || !body.entityId) {
    throw new RequestValidationError("entityModule and entityId are required when creating a draft")
  }

  const provenance = body.sourceKind
    ? {
        sourceKind: body.sourceKind,
        sourceConnectionId: body.sourceConnectionId,
        sourceRef: body.sourceRef,
      }
    : await resolveEntityProvenance(c, options, db, body.entityModule, body.entityId)

  const created = await createBookingDraft(db, {
    id,
    entityModule: body.entityModule,
    entityId: body.entityId,
    sourceKind: provenance.sourceKind,
    sourceConnectionId: provenance.sourceConnectionId,
    sourceRef: provenance.sourceRef,
    draftPayload: body.draftPayload,
    currentStep: body.currentStep,
    currentQuoteId: body.currentQuoteId,
    createdBy: resolveActorId(c, options),
    ttlMs: body.ttlMs,
  })
  return c.json(created, 201)
}

async function handleDraftGet(c: Context, options: CatalogBookingRoutesOptions): Promise<Response> {
  const id = c.req.param("id")
  if (!id) throw new RequestValidationError("id is required")
  const row = await getBookingDraft(options.resolveDb(c), id)
  if (!row) return c.json({ error: "draft not found" }, 404)
  return c.json(row)
}

async function handleDraftDelete(
  c: Context,
  options: CatalogBookingRoutesOptions,
): Promise<Response> {
  const id = c.req.param("id")
  if (!id) throw new RequestValidationError("id is required")
  await deleteBookingDraft(options.resolveDb(c), id)
  return c.body(null, 204)
}

async function handleHoldPlace(
  c: Context,
  options: CatalogBookingRoutesOptions,
): Promise<Response> {
  const body = await parseJsonBody(c, holdPlaceBodySchema)
  const ownedHandlers = options.resolveOwnedHandlers?.(c)
  const handler = ownedHandlers?.resolve(body.entityModule)
  if (!handler?.placeHold) {
    return c.json({ error: "no hold primitive registered for this vertical" }, 503)
  }

  const db = options.resolveDb(c)
  const correlationId = resolveCorrelationId(c, options)
  const ttlMs =
    body.ttlMs ??
    (await (options.resolveHoldTtlMs?.({
      c,
      db,
      entityModule: body.entityModule,
      entityId: body.entityId,
    }) ?? DEFAULT_HOLD_TTL_MS))
  const adapterContext = resolveAdapterContext(c, options, {
    db,
    operation: "hold",
    entityModule: body.entityModule,
    entityId: body.entityId,
    sourceKind: "engine",
    correlationId,
  })

  try {
    const result = await handler.placeHold(
      { db, adapterContext },
      {
        entityModule: body.entityModule,
        entityId: body.entityId,
        draftId: body.draftId,
        ttlMs,
        parameters: body.parameters,
      },
    )
    return c.json({ holdToken: result.holdToken, expiresAt: result.expiresAt.toISOString() })
  } catch (err) {
    return bookingEngineErrorResponse(c, err)
  }
}

async function handleHoldRelease(
  c: Context,
  options: CatalogBookingRoutesOptions,
): Promise<Response> {
  const body = await parseJsonBody(c, holdReleaseBodySchema)
  const ownedHandlers = options.resolveOwnedHandlers?.(c)
  const handler = ownedHandlers?.resolve(body.entityModule)
  if (!handler?.releaseHold) {
    return c.body(null, 204)
  }

  const db = options.resolveDb(c)
  const correlationId = resolveCorrelationId(c, options)
  const adapterContext = resolveAdapterContext(c, options, {
    db,
    operation: "hold",
    entityModule: body.entityModule,
    sourceKind: "engine",
    correlationId,
  })

  try {
    await handler.releaseHold({ db, adapterContext }, body.holdToken)
    return c.body(null, 204)
  } catch (err) {
    return bookingEngineErrorResponse(c, err)
  }
}

async function resolveEntityProvenance(
  c: Context,
  options: CatalogBookingRoutesOptions,
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<CatalogBookingProvenance> {
  if (options.resolveEntityProvenance) {
    return options.resolveEntityProvenance({ c, db, entityModule, entityId })
  }

  const row = await readSourcedEntry(db, entityModule, entityId)
  if (!row) return { sourceKind: OWNED_SOURCE_KIND }
  return {
    sourceKind: row.source_kind,
    sourceProvider: row.source_provider ?? undefined,
    sourceConnectionId: row.source_connection_id ?? undefined,
    sourceRef: row.source_ref ?? undefined,
  }
}

function resolveActorId(c: Context, options: CatalogBookingRoutesOptions): string | null {
  if (options.resolveActorId) return options.resolveActorId(c)
  const userId = (c.var as { userId?: string }).userId
  return typeof userId === "string" ? userId : null
}

function resolveCorrelationId(c: Context, options: CatalogBookingRoutesOptions): string {
  return options.resolveCorrelationId?.(c) ?? c.req.header("x-request-id") ?? cryptoRandom()
}

function resolveAdapterContext(
  c: Context,
  options: CatalogBookingRoutesOptions,
  input: Omit<CatalogBookingAdapterContextInput, "c">,
): SourceAdapterContext {
  return (
    options.resolveAdapterContext?.({ c, ...input }) ?? {
      connection_id: input.sourceConnectionId ?? input.sourceKind,
      correlation_id: input.correlationId,
    }
  )
}

function defaultAudienceForPath(c: Context): "staff" | "customer" {
  return c.req.path.startsWith("/v1/public/") ? "customer" : "staff"
}

function engineParametersFromDraft(
  parameters: Record<string, unknown> | undefined,
  draftPayload: unknown,
): Record<string, unknown> {
  const draft = asRecord(draftPayload)
  const configure = asRecord(draft?.configure)
  const departureSlotId = stringValue(configure?.departureSlotId)
  const paxCount = sumDraftPax(configure?.pax)
  const next: Record<string, unknown> = {
    ...(parameters ?? {}),
    ...(draft ? { draft } : {}),
  }

  if (departureSlotId) {
    if (next.departureSlotId == null) next.departureSlotId = departureSlotId
    if (next.departure_id == null) next.departure_id = departureSlotId
    if (next.slotId == null) next.slotId = departureSlotId
  }
  if (paxCount > 0 && next.paxCount == null) {
    next.paxCount = paxCount
  }
  for (const key of ["roomTypeId", "ratePlanId", "board"] as const) {
    const value = stringValue(configure?.[key])
    if (value && next[key] == null) next[key] = value
  }
  // Lift `draft.promotionCode` to the top-level so `quoteEntity`'s
  // promotion hook can read it without descending into the nested
  // draft. Same lifting pattern as `paxCount` above. Per
  // docs/architecture/promotions-architecture.md §7.0.
  const promotionCode = stringValue(draft?.promotionCode)
  if (promotionCode && next.promotionCode == null) {
    next.promotionCode = promotionCode
  }

  return next
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function sumDraftPax(value: unknown): number {
  const pax = asRecord(value)
  if (!pax) return 0
  let total = 0
  for (const count of Object.values(pax)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) {
      total += count
    }
  }
  return total
}

function bookingEngineErrorResponse(c: Context, err: unknown): Response {
  if (err instanceof BookingEngineError) {
    const status = statusForCode(err.code)
    return c.json({ error: err.message, code: err.code, context: err.context }, status as never)
  }
  return handleApiError(err, c)
}

function statusForCode(code: string): number {
  switch (code) {
    case NO_ADAPTER_REGISTERED:
    case NO_HANDLER_REGISTERED:
      return 503
    case QUOTE_NOT_FOUND:
    case ORDER_NOT_FOUND:
      return 404
    case QUOTE_EXPIRED:
    case QUOTE_MISMATCH:
    case ORDER_ALREADY_CANCELLED:
      return 409
    case RESERVE_FAILED:
      return 502
    default:
      return 500
  }
}

function cryptoRandom(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function serializeQuoteResult(result: QuoteEntityResult): QuoteResponseV1 {
  return quoteResponseV1.parse({
    ...result,
    quotedAt: result.quotedAt.toISOString(),
    expiresAt: result.expiresAt.toISOString(),
    pricing: toPricingBreakdownV1(result.pricing),
  })
}

function serializeBookResult(result: BookEntityResult): BookResponseV1 {
  return bookResponseV1.parse({
    ...result,
    pricing: toPricingBreakdownV1(result.pricing),
  })
}

function toPricingBreakdownV1(basis: PricingBasis | undefined): PricingBreakdownV1 | undefined {
  if (!basis) return undefined
  if (basis.breakdown) {
    const breakdown = basis.breakdown as PricingBreakdownV1
    if (breakdown.currency && Array.isArray(breakdown.lines) && Array.isArray(breakdown.taxes)) {
      return breakdown
    }
  }
  const lines: PricingBreakdownV1["lines"] = [
    {
      kind: "base",
      label: "Base",
      quantity: 1,
      unitAmount: basis.base_amount,
      totalAmount: basis.base_amount,
    },
  ]
  if (basis.fees > 0) {
    lines.push({ kind: "fee", label: "Fees", unitAmount: basis.fees, totalAmount: basis.fees })
  }
  if (basis.surcharges > 0) {
    lines.push({
      kind: "supplement",
      label: "Surcharges",
      unitAmount: basis.surcharges,
      totalAmount: basis.surcharges,
    })
  }
  const subtotal = basis.base_amount + basis.fees + basis.surcharges
  return {
    currency: basis.currency,
    lines,
    taxes:
      basis.taxes > 0
        ? [
            {
              code: "tax",
              label: "Tax",
              rate: 0,
              amount: basis.taxes,
              base: basis.base_amount,
            },
          ]
        : [],
    subtotal,
    taxTotal: basis.taxes,
    total: subtotal + basis.taxes,
  }
}
