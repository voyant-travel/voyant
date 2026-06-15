/**
 * Quote-version proposal + Trip-snapshot HTTP routes, owned by the quotes
 * module.
 *
 * agent-quality: file-size exception -- the proposal lifecycle (admin send,
 * public get/accept/decline) plus the Trip-snapshot freeze form one cohesive
 * route family backed by the same quotes/trips services; splitting it would
 * scatter a single accept-under-lock contract.
 *
 *   Admin proposal (mount at /v1/admin/quote-versions):
 *     POST   /:quoteVersionId/send
 *   Public proposal (mount at /v1/public/proposals):
 *     GET    /:quoteVersionId
 *     POST   /:quoteVersionId/accept
 *     POST   /:quoteVersionId/decline
 *   Admin snapshot (mount at /v1/admin/trips):
 *     POST   /:envelopeId/quote-versions/:quoteVersionId/snapshot
 *
 * These shapes (validation, status codes, the accept-under-advisory-lock flow,
 * the snapshot↔proposal equivalence checks, and the pure
 * `tripSnapshotToQuoteVersionApply` mapper) are framework logic and live here.
 *
 * The deployment supplies the concrete db resolver, the public proposal base
 * URL resolver, the trips reserve/checkout deps, and the public operator
 * profile via `QuoteProposalRoutesOptions` — all generic / structural so this
 * package stays free of operator types and CloudflareBindings.
 */
import { parseJsonBody, parseOptionalJsonBody } from "@voyant-travel/hono"
import {
  type ReserveTripDeps,
  type StartCheckoutDeps,
  type StartCheckoutResult,
  type Trip,
  type TripSnapshot,
  type TripSnapshotProposalLine,
  TripsInvariantError,
  tripsService,
} from "@voyant-travel/trips"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"
import { z } from "zod"

import type { QuoteVersion, QuoteVersionLine } from "./schema.js"
import { QuoteVersionConflictError, quotesService } from "./service/index.js"
import { sendQuoteVersionSchema } from "./validation.js"

/**
 * Deployment-supplied dependencies for the quote proposal + snapshot routes.
 *
 * Generic / structural types keep the quotes package free of operator types and
 * CloudflareBindings — the deployment casts `c.get("db")` to its own concrete
 * type inside `resolveDb` and supplies its trips reserve/checkout deps and
 * public operator profile.
 */
export interface QuoteProposalRoutesOptions {
  /** Resolve the concrete transactional db for a request. */
  resolveDb(c: Context): PostgresJsDatabase
  /**
   * Resolve the public base URL for proposal links (e.g. the customer dashboard
   * origin). Returns `null` to emit a root-relative path.
   */
  resolvePublicProposalBaseUrl(c: Context): string | null
  /** Build the trips reserve deps for a request (catalog/non-catalog wiring). */
  reserveTripDeps(c: Context): ReserveTripDeps
  /** Build the trips checkout deps for a request (payment-session wiring). */
  startCheckoutDeps(c: Context): StartCheckoutDeps
  /**
   * Resolve the deployment's public operator profile, surfaced on the public
   * proposal payload. Returns `null` when no profile is configured.
   */
  resolveOperatorProfile(db: PostgresJsDatabase): Promise<unknown | null>
}

type OperatorProposalRouteEnv = {
  Bindings: Record<string, unknown>
  Variables: {
    db: unknown
    userId?: string
  }
}

type OperatorQuoteVersionSnapshotRouteEnv = {
  Variables: {
    db: unknown
    userId?: string
  }
}

export interface PublicQuoteVersionProposal {
  title: string
  status: QuoteVersion["status"]
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  totalAmountCents: number
  validUntil: string | null
  lines: PublicQuoteVersionProposalLine[]
  operator: unknown | null
  proposalUrl: string
}

export interface PublicQuoteVersionProposalLine {
  description: string
  quantity: number
  unitPriceAmountCents: number
  totalAmountCents: number
  currency: string
}

export interface SendQuoteVersionResult {
  quoteVersion: QuoteVersion
  proposalUrl: string
}

export interface DeclinePublicProposalResult {
  status: QuoteVersion["status"]
}

export interface AcceptPublicProposalResult {
  status: Extract<QuoteVersion["status"], "accepted">
  checkoutUrl: string | null
  paymentSessionId: string | null
  currency: string
  totalAmountCents: number
  warnings: string[]
}

export type ApplyTripSnapshotToQuoteVersionResult = {
  snapshot: TripSnapshot
  quoteVersion: QuoteVersion
  lines: QuoteVersionLine[]
}

type ApplyTripSnapshotPayload = Parameters<typeof quotesService.applyTripSnapshotToQuoteVersion>[2]

type QuoteVersionProposalReadModel = NonNullable<
  Awaited<ReturnType<typeof quotesService.getQuoteVersionProposal>>
>
type AcceptQuoteVersionResult = NonNullable<
  Awaited<ReturnType<typeof quotesService.acceptQuoteVersion>>
>
type LockedAcceptResult =
  | {
      kind: "accepted"
      accepted: AcceptQuoteVersionResult
      snapshot: TripSnapshot
      warnings: string[]
    }
  | { kind: "response"; response: Response }

const acceptPublicProposalSchema = z.object({
  intent: z.enum(["card", "bank_transfer"]).default("card"),
  idempotencyKey: z.string().min(1).max(120).optional(),
})

const freezeQuoteVersionSnapshotBodySchema = z.object({
  createdBy: z.string().min(1).nullable().optional(),
})

/** Build a proposal URL — absolute when a base URL is supplied, else root-relative. */
export function buildQuoteVersionProposalUrl(
  quoteVersionId: string,
  options: { baseUrl?: string | null } = {},
) {
  const path = `/proposal/${encodeURIComponent(quoteVersionId)}`
  const baseUrl = options.baseUrl?.trim().replace(/\/+$/, "")
  return baseUrl ? `${baseUrl}${path}` : path
}

function toPublicQuoteVersionProposal(
  proposal: QuoteVersionProposalReadModel,
  options: {
    quoteVersion?: QuoteVersion | null
    operator: unknown | null
    proposalUrl: string
  },
): PublicQuoteVersionProposal {
  const quoteVersion = options.quoteVersion ?? proposal.quoteVersion

  return {
    title: proposal.quote.title,
    status: quoteVersion.status,
    currency: quoteVersion.currency,
    subtotalAmountCents: quoteVersion.subtotalAmountCents,
    taxAmountCents: quoteVersion.taxAmountCents,
    totalAmountCents: quoteVersion.totalAmountCents,
    validUntil: quoteVersion.validUntil,
    lines: proposal.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceAmountCents: line.unitPriceAmountCents,
      totalAmountCents: line.totalAmountCents,
      currency: line.currency,
    })),
    operator: options.operator,
    proposalUrl: options.proposalUrl,
  }
}

/** Build the admin proposal routes (relative paths; mount at `/v1/admin/quote-versions`). */
export function createQuoteProposalAdminRoutes(
  options: QuoteProposalRoutesOptions,
): Hono<OperatorProposalRouteEnv> {
  const app = new Hono<OperatorProposalRouteEnv>()
  app.post("/:quoteVersionId/send", (c) => handleSendQuoteVersion(c, options))
  return app
}

/** Build the public proposal routes (relative paths; mount at `/v1/public/proposals`). */
export function createQuoteProposalPublicRoutes(
  options: QuoteProposalRoutesOptions,
): Hono<OperatorProposalRouteEnv> {
  const app = new Hono<OperatorProposalRouteEnv>()
  app.get("/:quoteVersionId", (c) => handleGetPublicProposal(c, options))
  app.post("/:quoteVersionId/accept", (c) => handleAcceptPublicProposal(c, options))
  app.post("/:quoteVersionId/decline", (c) => handleDeclinePublicProposal(c, options))
  return app
}

/** Build the Trip-snapshot freeze route (relative path; mount at `/v1/admin/trips`). */
export function createQuoteVersionSnapshotRoutes(
  options: QuoteProposalRoutesOptions,
): Hono<OperatorQuoteVersionSnapshotRouteEnv> {
  const app = new Hono<OperatorQuoteVersionSnapshotRouteEnv>()
  app.post("/:envelopeId/quote-versions/:quoteVersionId/snapshot", (c) =>
    handleFreezeQuoteVersionSnapshot(c, options),
  )
  return app
}

async function handleSendQuoteVersion(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  try {
    const quoteVersion = await quotesService.sendQuoteVersion(
      options.resolveDb(c),
      quoteVersionId,
      await parseOptionalJsonBody(c, sendQuoteVersionSchema),
    )
    if (!quoteVersion) return c.json({ error: "Quote Version not found" }, 404)

    return c.json({
      data: {
        quoteVersion,
        proposalUrl: buildQuoteVersionProposalUrl(quoteVersion.id, {
          baseUrl: options.resolvePublicProposalBaseUrl(c),
        }),
      } satisfies SendQuoteVersionResult,
    })
  } catch (error) {
    if (error instanceof QuoteVersionConflictError) {
      return c.json({ error: error.message }, 409)
    }
    throw error
  }
}

async function handleGetPublicProposal(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const db = options.resolveDb(c)
  await quotesService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }

  const viewedQuoteVersion =
    proposal.quoteVersion.status === "sent"
      ? await quotesService.markQuoteVersionViewed(db, quoteVersionId)
      : proposal.quoteVersion
  const operator = await options.resolveOperatorProfile(db)

  return c.json({
    data: toPublicQuoteVersionProposal(proposal, {
      quoteVersion: viewedQuoteVersion,
      operator: operator ?? null,
      proposalUrl: buildQuoteVersionProposalUrl(quoteVersionId, {
        baseUrl: options.resolvePublicProposalBaseUrl(c),
      }),
    }),
  })
}

async function handleDeclinePublicProposal(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const db = options.resolveDb(c)
  await quotesService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }

  try {
    const quoteVersion = await quotesService.declineQuoteVersion(db, quoteVersionId)
    if (!quoteVersion) return c.json({ error: "Proposal not found" }, 404)
    return c.json({
      data: { status: quoteVersion.status } satisfies DeclinePublicProposalResult,
    })
  } catch (error) {
    if (error instanceof QuoteVersionConflictError) {
      return c.json({ error: error.message }, 409)
    }
    throw error
  }
}

async function handleAcceptPublicProposal(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const body = await parseOptionalJsonBody(c, acceptPublicProposalSchema)
  const db = options.resolveDb(c)
  const proposalForLock = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposalForLock) return c.json({ error: "Proposal not found" }, 404)

  try {
    const lockedResult = await db.transaction((tx) =>
      acceptPublicProposalWithQuoteLock({
        c,
        options,
        db: tx as PostgresJsDatabase,
        quoteId: proposalForLock.quote.id,
        quoteVersionId,
        body,
      }),
    )
    if (lockedResult.kind === "response") return lockedResult.response

    const checkout = await startAcceptedProposalCheckout(
      c,
      options,
      lockedResult.snapshot,
      body,
      quoteVersionId,
    )
    const checkoutWarnings = checkout
      ? checkout.failures.map((failure) => failure.reason)
      : ["checkout_start_failed"]

    return c.json({
      data: {
        status: "accepted",
        checkoutUrl: checkout?.target.checkoutUrl ?? null,
        paymentSessionId: checkout?.target.paymentSessionId ?? null,
        currency: checkout?.target.currency ?? lockedResult.accepted.quoteVersion.currency,
        totalAmountCents:
          checkout?.target.totalAmountCents ?? lockedResult.accepted.quoteVersion.totalAmountCents,
        warnings: [...lockedResult.warnings, ...(checkout?.warnings ?? []), ...checkoutWarnings],
      } satisfies AcceptPublicProposalResult,
    })
  } catch (error) {
    if (error instanceof QuoteVersionConflictError) {
      return c.json({ error: error.message }, 409)
    }
    if (error instanceof TripsInvariantError) {
      return c.json({ error: error.message }, error.message.includes("was not found") ? 404 : 409)
    }
    throw error
  }
}

async function acceptPublicProposalWithQuoteLock({
  c,
  options,
  db,
  quoteId,
  quoteVersionId,
  body,
}: {
  c: Context<OperatorProposalRouteEnv>
  options: QuoteProposalRoutesOptions
  db: PostgresJsDatabase
  quoteId: string
  quoteVersionId: string
  body: z.infer<typeof acceptPublicProposalSchema>
}): Promise<LockedAcceptResult> {
  await lockQuoteAccept(db, quoteId)
  await quotesService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }
  if (proposal.quoteVersion.status === "draft") {
    return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }
  }
  if (proposal.quoteVersion.status === "superseded") {
    return {
      kind: "response",
      response: c.json({ error: "Proposal has been superseded" }, 410),
    }
  }
  const isAcceptedReplay =
    proposal.quoteVersion.status === "accepted" &&
    proposal.quote.acceptedVersionId === proposal.quoteVersion.id
  if (proposal.quoteVersion.status !== "sent" && !isAcceptedReplay) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal can no longer be accepted" }, 409),
    }
  }
  if (!proposal.quoteVersion.tripSnapshotId) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal has no frozen Trip snapshot" }, 409),
    }
  }

  const snapshot = await tripsService.getTripSnapshotById(db, proposal.quoteVersion.tripSnapshotId)
  if (!snapshot) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip snapshot not found" }, 409),
    }
  }

  assertProposalMatchesTripSnapshot(proposal, snapshot)
  if (isAcceptedReplay) {
    const accepted = await quotesService.acceptQuoteVersion(db, quoteVersionId, {})
    if (!accepted) {
      return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }
    }

    return { kind: "accepted", accepted, snapshot, warnings: [] }
  }

  assertSnapshotCanUsePublicAcceptReserve(snapshot)

  const liveTrip = await tripsService.getTrip(db, snapshot.envelopeId)
  if (!liveTrip) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip envelope not found" }, 409),
    }
  }
  assertLiveTripMatchesSnapshot(liveTrip, snapshot)

  const reserveIdempotencyKey = `proposal-accept-reserve:${quoteVersionId}:${
    body.idempotencyKey ?? "default"
  }`
  const reserved = await tripsService.reserveTrip(
    db,
    {
      envelopeId: snapshot.envelopeId,
      idempotencyKey: reserveIdempotencyKey,
      refreshScope: {
        locale: "en-US",
        audience: "customer",
        market: "default",
        currency: snapshot.currency,
      },
    },
    options.reserveTripDeps(c),
  )
  if (reserved.failures.length > 0) {
    return {
      kind: "response",
      response: c.json(
        {
          error: "Proposal could not be reserved",
          failures: reserved.failures.map(({ code, reason }) => ({ code, reason })),
        },
        409,
      ),
    }
  }

  const accepted = await quotesService.acceptQuoteVersion(db, quoteVersionId, {})
  if (!accepted) return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }

  return { kind: "accepted", accepted, snapshot, warnings: reserved.warnings }
}

function lockQuoteAccept(db: PostgresJsDatabase, quoteId: string) {
  return db.execute(
    // agent-quality: raw-sql reviewed -- owner: quotes; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${quoteAcceptLockKey(quoteId)}, 0))`,
  )
}

function quoteAcceptLockKey(quoteId: string) {
  return `quote-accept:${quoteId}`
}

function assertSnapshotCanUsePublicAcceptReserve(snapshot: TripSnapshot) {
  const sourcedCatalogComponent = snapshot.frozenComponents.find(isSourcedCatalogSnapshotComponent)
  if (!sourcedCatalogComponent) return

  // reserveTrip runs under the Quote accept transaction. Owned catalog holds
  // and manual placeholders are DB-local, but sourced catalog adapters can
  // create upstream holds before local release records commit.
  throw new QuoteVersionConflictError(
    "Sourced catalog components cannot be accepted from public proposals yet",
  )
}

function isSourcedCatalogSnapshotComponent(component: Record<string, unknown>): boolean {
  return Boolean(
    component.kind === "catalog_booking" &&
      component.entityModule &&
      component.entityId &&
      component.sourceKind &&
      component.sourceKind !== "owned",
  )
}

async function startAcceptedProposalCheckout(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
  snapshot: TripSnapshot,
  body: z.infer<typeof acceptPublicProposalSchema>,
  quoteVersionId: string,
): Promise<StartCheckoutResult | null> {
  try {
    return await tripsService.startCheckout(
      options.resolveDb(c),
      {
        envelopeId: snapshot.envelopeId,
        intent: body.intent,
        idempotencyKey: `proposal-accept-checkout:${quoteVersionId}:${body.intent}:${
          body.idempotencyKey ?? "default"
        }`,
        request: {
          initiatedBy: "public-proposal",
          collectionCurrency: snapshot.currency,
        },
      },
      options.startCheckoutDeps(c),
    )
  } catch (error) {
    console.warn("[proposal] checkout handoff failed after proposal acceptance:", error)
    return null
  }
}

function assertLiveTripMatchesSnapshot(trip: Trip, snapshot: TripSnapshot) {
  const liveComponents = trip.components.filter((component) => component.status !== "removed")
  if (
    stableSnapshotString(trip.envelope) !== stableSnapshotString(snapshot.frozenEnvelope) ||
    stableSnapshotString(liveComponents) !== stableSnapshotString(snapshot.frozenComponents)
  ) {
    throw new QuoteVersionConflictError(
      "Proposal Trip has changed since this Quote Version was sent",
    )
  }
}

function assertProposalMatchesTripSnapshot(
  proposal: QuoteVersionProposalReadModel,
  snapshot: TripSnapshot,
) {
  const expected = tripSnapshotToQuoteVersionApply(snapshot)
  const actual = proposal.quoteVersion

  if (
    actual.tripSnapshotId !== snapshot.id ||
    actual.currency !== expected.currency ||
    actual.subtotalAmountCents !== expected.subtotalAmountCents ||
    actual.taxAmountCents !== expected.taxAmountCents ||
    actual.totalAmountCents !== expected.totalAmountCents ||
    proposal.lines.length !== expected.lines.length
  ) {
    throw new QuoteVersionConflictError("Proposal does not match its frozen Trip snapshot")
  }

  for (const [index, expectedLine] of expected.lines.entries()) {
    const actualLine = proposal.lines[index]
    if (
      !actualLine ||
      actualLine.description !== expectedLine.description ||
      actualLine.quantity !== expectedLine.quantity ||
      actualLine.unitPriceAmountCents !== expectedLine.unitPriceAmountCents ||
      actualLine.totalAmountCents !== expectedLine.totalAmountCents ||
      actualLine.currency !== expectedLine.currency
    ) {
      throw new QuoteVersionConflictError("Proposal does not match its frozen Trip snapshot")
    }
  }
}

function stableSnapshotString(value: unknown): string {
  return JSON.stringify(canonicalSnapshotValue(value))
}

function canonicalSnapshotValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalSnapshotValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, canonicalSnapshotValue(entryValue)]),
    )
  }
  return value
}

async function handleFreezeQuoteVersionSnapshot(
  c: Context<OperatorQuoteVersionSnapshotRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const envelopeId = c.req.param("envelopeId")
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!envelopeId) return c.json({ error: "Trip envelope id is required" }, 400)
  if (!quoteVersionId) return c.json({ error: "Quote version id is required" }, 400)

  const db = options.resolveDb(c)
  const body = await parseJsonBody(c, freezeQuoteVersionSnapshotBodySchema)

  try {
    const quoteVersion = await quotesService.getQuoteVersionById(db, quoteVersionId)
    if (!quoteVersion) return c.json({ error: "Quote version not found" }, 404)
    if (quoteVersion.status !== "draft") {
      return c.json({ error: "Trip snapshots can only be applied to draft Quote Versions" }, 409)
    }

    const userId = c.get("userId")
    const snapshot = await tripsService.freezeTripSnapshot(db, {
      envelopeId,
      createdBy: typeof userId === "string" ? userId : (body.createdBy ?? undefined),
    })
    const applied = await quotesService.applyTripSnapshotToQuoteVersion(
      db,
      quoteVersionId,
      tripSnapshotToQuoteVersionApply(snapshot),
    )

    if (!applied) return c.json({ error: "Quote version not found" }, 404)

    return c.json(
      {
        data: {
          snapshot,
          quoteVersion: applied.quoteVersion,
          lines: applied.lines,
        } satisfies ApplyTripSnapshotToQuoteVersionResult,
      },
      201,
    )
  } catch (error) {
    if (error instanceof TripsInvariantError) {
      return c.json({ error: error.message }, error.message.includes("was not found") ? 404 : 409)
    }
    if (error instanceof QuoteVersionConflictError) {
      return c.json({ error: error.message }, 409)
    }
    throw error
  }
}

/** Map a frozen Trip snapshot's proposal into a quote-version apply payload. */
export function tripSnapshotToQuoteVersionApply(snapshot: TripSnapshot): ApplyTripSnapshotPayload {
  const proposal = snapshot.proposal
  return {
    tripSnapshotId: snapshot.id,
    currency: proposal.currency,
    subtotalAmountCents: proposal.subtotalAmountCents,
    taxAmountCents: proposal.taxAmountCents,
    totalAmountCents: proposal.totalAmountCents,
    lines: proposal.lines.map(tripSnapshotLineToQuoteVersionLine),
  }
}

function tripSnapshotLineToQuoteVersionLine(line: TripSnapshotProposalLine) {
  return {
    componentId: line.componentId,
    productId: line.entityModule === "products" ? line.entityId : null,
    supplierServiceId: line.entityModule === "supplier_services" ? line.entityId : null,
    description: line.description,
    quantity: 1,
    unitPriceAmountCents: line.subtotalAmountCents,
    totalAmountCents: line.totalAmountCents,
    currency: line.currency,
  }
}
