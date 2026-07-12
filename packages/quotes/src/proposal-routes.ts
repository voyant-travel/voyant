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
 *     POST   /:quoteVersionId/request-edits
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
import { OpenAPIHono } from "@hono/zod-openapi"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { parseJsonBody, parseOptionalJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import {
  type CancelTripComponentsDeps,
  type ReserveTripDeps,
  type ReserveTripResult,
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
import { quotesProposalRuntimePort, quotesSnapshotRuntimePort } from "./runtime-port.js"
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
  reserveTripDeps(c: Context): ReserveTripDeps | Promise<ReserveTripDeps>
  /** Build the trips checkout deps for a request (payment-session wiring). */
  startCheckoutDeps(c: Context): StartCheckoutDeps | Promise<StartCheckoutDeps>
  /**
   * Build the trips cancel deps for a request (provider hold-release wiring).
   * Used to release a reserved Trip when final CRM acceptance loses a race.
   */
  cancelTripComponentsDeps(c: Context): CancelTripComponentsDeps | Promise<CancelTripComponentsDeps>
  /**
   * Resolve the deployment's public operator profile, surfaced on the public
   * proposal payload. Returns `null` when no profile is configured.
   */
  resolveOperatorProfile(db: PostgresJsDatabase): Promise<unknown | null>
  /**
   * Optional deployment hook for public customer feedback. Deployments can use
   * this to write CRM activity rows, trigger notifications/workflows, or both.
   */
  recordPublicProposalFeedback?(
    db: PostgresJsDatabase,
    input: PublicProposalFeedbackInput,
    c: Context,
  ): Promise<PublicProposalFeedbackRecord | null>
}

export const QUOTE_PROPOSAL_OPENAPI_API_IDS = {
  admin: "@voyant-travel/quotes#proposal-extension.api.admin",
  public: "@voyant-travel/quotes#proposal-extension.api.public",
} as const

export const QUOTE_VERSION_SNAPSHOT_OPENAPI_API_ID =
  "@voyant-travel/quotes#quote-version-snapshot-extension.api"

const PUBLIC_PROPOSAL_OPENAPI_OPERATIONS = [
  ["get", "/{quoteVersionId}", "Get a public quote proposal"],
  ["post", "/{quoteVersionId}/accept", "Accept a public quote proposal"],
  ["post", "/{quoteVersionId}/decline", "Decline a public quote proposal"],
  ["post", "/{quoteVersionId}/request-edits", "Request quote proposal edits"],
] as const

export interface QuoteVersionSnapshotRoutesOptions {
  /** Resolve the concrete transactional db for a request. */
  resolveDb(c: Context): PostgresJsDatabase
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
  notes: string | null
  lines: PublicQuoteVersionProposalLine[]
  media: PublicQuoteVersionProposalMedia[]
  operator: unknown | null
  proposalUrl: string
  /**
   * Whether the client can accept this proposal. Acceptance reserves a frozen
   * Trip snapshot, so product-only proposals (no `tripSnapshotId`) are
   * review-only — the client can decline but the Accept action is hidden to
   * avoid a guaranteed 409 ("Proposal has no frozen Trip snapshot").
   */
  acceptable: boolean
}

export interface PublicQuoteVersionProposalMedia {
  url: string
  name: string
  altText: string | null
  mediaType: string
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

export interface PublicProposalFeedbackInput {
  quoteId: string
  quoteVersionId: string
  message: string
  proposalUrl: string
}

export interface PublicProposalFeedbackRecord {
  id: string
}

export interface RequestPublicProposalEditsResult {
  status: Extract<QuoteVersion["status"], "sent">
  feedbackId: string | null
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
/**
 * Outcome of the prepare phase (txn 1, under the quote-accept lock). `accepted`
 * is the idempotent-replay fast path (this version was already accepted under
 * the lock); `prepared` means a fresh `sent` version passed all snapshot checks
 * and is ready to reserve OUTSIDE the transaction.
 */
type PreparedAcceptResult =
  | {
      kind: "accepted"
      accepted: AcceptQuoteVersionResult
      snapshot: TripSnapshot
      warnings: string[]
    }
  | { kind: "prepared"; snapshot: TripSnapshot }
  | { kind: "response"; response: Response }

/** Outcome of the finalize phase (txn 2, under the quote-accept lock). */
type FinalizedAcceptResult =
  | { kind: "accepted"; accepted: AcceptQuoteVersionResult }
  | { kind: "response"; response: Response }

const acceptPublicProposalSchema = z.object({
  intent: z.enum(["card", "bank_transfer"]).default("card"),
  idempotencyKey: z.string().min(1).max(120).optional(),
})

const requestPublicProposalEditsSchema = z.object({
  message: z.string().trim().min(1).max(4000),
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
    media?: ReadonlyArray<{
      url: string
      name: string
      altText: string | null
      mediaType: string
    }>
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
    notes: quoteVersion.notes,
    lines: proposal.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceAmountCents: line.unitPriceAmountCents,
      totalAmountCents: line.totalAmountCents,
      currency: line.currency,
    })),
    media: (options.media ?? []).map((item) => ({
      url: item.url,
      name: item.name,
      altText: item.altText,
      mediaType: item.mediaType,
    })),
    operator: options.operator,
    proposalUrl: options.proposalUrl,
    // Only Trip-snapshot-backed versions can be reserved on accept.
    acceptable: quoteVersion.tripSnapshotId !== null,
  }
}

/** Build the admin proposal routes (relative paths; mount at `/v1/admin/quote-versions`). */
export function createQuoteProposalAdminRoutes(
  options: QuoteProposalRoutesOptions,
): Hono<OperatorProposalRouteEnv> {
  const app = new Hono<OperatorProposalRouteEnv>()
  app.post("/:quoteVersionId/send", (c) => handleSendQuoteVersion(c, options))
  app.get("/:quoteVersionId/proposal-link", (c) => handleGetQuoteVersionProposalLink(c, options))
  return app
}

/** Build the public proposal routes (relative paths; mount at `/v1/public/proposals`). */
export function createQuoteProposalPublicRoutes(
  options: QuoteProposalRoutesOptions,
): OpenAPIHono<OperatorProposalRouteEnv> {
  const app = new OpenAPIHono<OperatorProposalRouteEnv>()
  app.get("/:quoteVersionId", (c) => handleGetPublicProposal(c, options))
  app.post("/:quoteVersionId/accept", (c) => handleAcceptPublicProposal(c, options))
  app.post("/:quoteVersionId/decline", (c) => handleDeclinePublicProposal(c, options))
  app.post("/:quoteVersionId/request-edits", (c) => handleRequestPublicProposalEdits(c, options))
  for (const [method, path, summary] of PUBLIC_PROPOSAL_OPENAPI_OPERATIONS) {
    app.openAPIRegistry.registerPath({
      method,
      path,
      summary,
      responses: { 200: { description: "Successful response." } },
      "x-voyant-api-id": QUOTE_PROPOSAL_OPENAPI_API_IDS.public,
    })
  }
  return app
}

/** Build the Trip-snapshot freeze route (relative path; mount at `/v1/admin/trips`). */
export function createQuoteVersionSnapshotRoutes(
  options: QuoteVersionSnapshotRoutesOptions,
): OpenAPIHono<OperatorQuoteVersionSnapshotRouteEnv> {
  const app = new OpenAPIHono<OperatorQuoteVersionSnapshotRouteEnv>()
  app.post("/:envelopeId/quote-versions/:quoteVersionId/snapshot", (c) =>
    handleFreezeQuoteVersionSnapshot(c, options),
  )
  app.openAPIRegistry.registerPath({
    method: "post",
    path: "/{envelopeId}/quote-versions/{quoteVersionId}/snapshot",
    summary: "Freeze a Trip snapshot into a Quote Version",
    responses: { 200: { description: "The updated Quote Version and frozen Trip snapshot." } },
    "x-voyant-api-id": QUOTE_VERSION_SNAPSHOT_OPENAPI_API_ID,
  })
  return app
}

/** Package-owned proposal extension descriptor; deployments inject cross-module readers. */
export function createQuoteProposalHonoExtension(
  options: QuoteProposalRoutesOptions,
): HonoExtension {
  return {
    extension: { name: "proposal", module: "quote-versions" },
    lazyAdminRoutes: async () => createQuoteProposalAdminRoutes(options),
    lazyPublicRoutes: async () => createQuoteProposalPublicRoutes(options),
    publicPath: "proposals",
    anonymous: true,
  }
}

/** Package-owned Trip snapshot extension descriptor; deployments inject the db resolver. */
export function createQuoteVersionSnapshotHonoExtension(
  options: QuoteVersionSnapshotRoutesOptions,
): HonoExtension {
  return {
    extension: { name: "quote-version-snapshot", module: "trips" },
    lazyAdminRoutes: async () => createQuoteVersionSnapshotRoutes(options),
  }
}

/** Package-owned graph adapter for the proposal extension. */
export const createQuoteProposalVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createQuoteProposalHonoExtension(await getPort(quotesProposalRuntimePort)),
)

/** Package-owned graph adapter for the quote-version snapshot extension. */
export const createQuoteVersionSnapshotVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) =>
    createQuoteVersionSnapshotHonoExtension(await getPort(quotesSnapshotRuntimePort)),
)

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

async function handleGetQuoteVersionProposalLink(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  // Resolve the deployment's public proposal URL without any side effects
  // (no view tracking, no status change) so operators can re-copy the link.
  return c.json({
    data: {
      proposalUrl: buildQuoteVersionProposalUrl(quoteVersionId, {
        baseUrl: options.resolvePublicProposalBaseUrl(c),
      }),
    },
  })
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
  const media = await quotesService.listQuoteMedia(db, proposal.quote.id)

  return c.json({
    data: toPublicQuoteVersionProposal(proposal, {
      quoteVersion: viewedQuoteVersion,
      operator: operator ?? null,
      media,
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

async function handleRequestPublicProposalEdits(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const body = await parseJsonBody(c, requestPublicProposalEditsSchema)
  const db = options.resolveDb(c)
  await quotesService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }
  if (proposal.quoteVersion.status !== "sent") {
    return c.json({ error: "Proposal can no longer receive edit requests" }, 409)
  }

  const feedback =
    (await options.recordPublicProposalFeedback?.(
      db,
      {
        quoteId: proposal.quote.id,
        quoteVersionId,
        message: body.message,
        proposalUrl: buildQuoteVersionProposalUrl(quoteVersionId, {
          baseUrl: options.resolvePublicProposalBaseUrl(c),
        }),
      },
      c,
    )) ?? null

  return c.json({
    data: {
      status: "sent",
      feedbackId: feedback?.id ?? null,
    } satisfies RequestPublicProposalEditsResult,
  })
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
  const quoteId = proposalForLock.quote.id

  try {
    // Phase 1 — prepare under the quote-accept lock (txn 1). Validates the
    // proposal/snapshot and either fast-paths an accepted replay or returns a
    // prepared snapshot ready to reserve.
    const prepared = await db.transaction((tx) =>
      preparePublicProposalAcceptWithQuoteLock({
        c,
        db: tx as PostgresJsDatabase,
        quoteId,
        quoteVersionId,
        body,
      }),
    )
    if (prepared.kind === "response") return prepared.response
    if (prepared.kind === "accepted") {
      return respondWithAcceptedProposal({
        c,
        options,
        snapshot: prepared.snapshot,
        body,
        quoteVersionId,
        accepted: prepared.accepted,
        reserveWarnings: prepared.warnings,
      })
    }

    // Phase 2 — reserve OUTSIDE any transaction, on the durable request db.
    // Sourced catalog adapters may create upstream supplier holds; running this
    // outside the CRM accept transaction keeps those holds durably recorded.
    // reserveTrip's own atomic claim serializes concurrent accepts so only one
    // request can create holds for the same envelope.
    const reserved = await reservePreparedPublicProposal(
      c,
      options,
      db,
      prepared.snapshot,
      body,
      quoteVersionId,
    )
    if (reserved.failures.length > 0) {
      return c.json(
        {
          error: "Proposal could not be reserved",
          failures: reserved.failures.map(({ code, reason }) => ({ code, reason })),
        },
        409,
      )
    }

    // Phase 3 — finalize CRM acceptance under the quote-accept lock (txn 2).
    // If the final accept loses a race (declined/superseded/conflict), release
    // the reservation so the supplier hold isn't orphaned.
    let finalized: FinalizedAcceptResult
    try {
      finalized = await db.transaction((tx) =>
        finalizePublicProposalAcceptWithQuoteLock({
          c,
          db: tx as PostgresJsDatabase,
          quoteId,
          quoteVersionId,
          snapshot: prepared.snapshot,
        }),
      )
    } catch (error) {
      await releaseAcceptedProposalReservation(c, options, db, prepared.snapshot, reserved, {
        quoteVersionId,
        reason: "quote_accept_failed",
      })
      throw error
    }

    if (finalized.kind === "response") {
      await releaseAcceptedProposalReservation(c, options, db, prepared.snapshot, reserved, {
        quoteVersionId,
        reason: "quote_accept_failed",
      })
      return finalized.response
    }

    return respondWithAcceptedProposal({
      c,
      options,
      snapshot: prepared.snapshot,
      body,
      quoteVersionId,
      accepted: finalized.accepted,
      reserveWarnings: reserved.warnings,
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

async function preparePublicProposalAcceptWithQuoteLock({
  c,
  db,
  quoteId,
  quoteVersionId,
  body,
}: {
  c: Context<OperatorProposalRouteEnv>
  db: PostgresJsDatabase
  quoteId: string
  quoteVersionId: string
  body: z.infer<typeof acceptPublicProposalSchema>
}): Promise<PreparedAcceptResult> {
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

  const liveTrip = await tripsService.getTrip(db, snapshot.envelopeId)
  if (!liveTrip) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip envelope not found" }, 409),
    }
  }

  // Resume a crashed acceptance: if the Trip was already reserved under this
  // proposal's reserve key (reserve succeeded, finalize never ran), the live
  // Trip is no longer `priced`, so skip the frozen-snapshot comparison and let
  // phase 2 replay the reservation idempotently before finalize accepts.
  if (
    !isResumableProposalReservation(
      liveTrip.envelope,
      proposalReserveIdempotencyKey(quoteVersionId, body),
    )
  ) {
    assertLiveTripMatchesSnapshot(liveTrip, snapshot)
  }

  return { kind: "prepared", snapshot }
}

async function finalizePublicProposalAcceptWithQuoteLock({
  c,
  db,
  quoteId,
  quoteVersionId,
  snapshot,
}: {
  c: Context<OperatorProposalRouteEnv>
  db: PostgresJsDatabase
  quoteId: string
  quoteVersionId: string
  snapshot: TripSnapshot
}): Promise<FinalizedAcceptResult> {
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
  if (
    proposal.quoteVersion.status === "accepted" &&
    proposal.quote.acceptedVersionId === proposal.quoteVersion.id
  ) {
    const accepted = await quotesService.acceptQuoteVersion(db, quoteVersionId, {})
    if (!accepted) {
      return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }
    }

    return { kind: "accepted", accepted }
  }
  if (proposal.quoteVersion.status !== "sent") {
    return {
      kind: "response",
      response: c.json({ error: "Proposal can no longer be accepted" }, 409),
    }
  }
  // The frozen snapshot must not have changed between prepare and finalize.
  if (proposal.quoteVersion.tripSnapshotId !== snapshot.id) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip snapshot changed before acceptance" }, 409),
    }
  }
  assertProposalMatchesTripSnapshot(proposal, snapshot)

  const accepted = await quotesService.acceptQuoteVersion(db, quoteVersionId, {})
  if (!accepted) return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }

  return { kind: "accepted", accepted }
}

async function reservePreparedPublicProposal(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
  db: PostgresJsDatabase,
  snapshot: TripSnapshot,
  body: z.infer<typeof acceptPublicProposalSchema>,
  quoteVersionId: string,
): Promise<ReserveTripResult> {
  return tripsService.reserveTrip(
    db,
    {
      envelopeId: snapshot.envelopeId,
      idempotencyKey: proposalReserveIdempotencyKey(quoteVersionId, body),
      refreshScope: {
        locale: "en-US",
        audience: "customer",
        market: "default",
        currency: snapshot.currency,
      },
    },
    await options.reserveTripDeps(c),
  )
}

/**
 * Deterministic reserve idempotency key for a proposal acceptance. Stable
 * across retries with the same request body, so a crashed accept can replay the
 * same reservation instead of creating a second supplier hold.
 */
function proposalReserveIdempotencyKey(
  quoteVersionId: string,
  body: z.infer<typeof acceptPublicProposalSchema>,
): string {
  return `proposal-accept-reserve:${quoteVersionId}:${body.idempotencyKey ?? "default"}`
}

/**
 * A live Trip that has already been claimed/reserved under THIS proposal's
 * reserve idempotency key is a resumable in-flight acceptance — not a "Trip
 * changed since sent" conflict. Recognising it lets a retry replay the
 * reservation and finalize, instead of wedging on the frozen `priced` snapshot
 * comparison and stranding the supplier hold.
 */
function isResumableProposalReservation(envelope: Trip["envelope"], reserveKey: string): boolean {
  return (
    envelope.reserveIdempotencyKey === reserveKey &&
    ["reserve_in_progress", "reserved", "checkout_started", "booked"].includes(envelope.status)
  )
}

async function releaseAcceptedProposalReservation(
  c: Context<OperatorProposalRouteEnv>,
  options: QuoteProposalRoutesOptions,
  db: PostgresJsDatabase,
  snapshot: TripSnapshot,
  reserved: ReserveTripResult,
  release: { quoteVersionId: string; reason: string },
) {
  // An idempotent replay returns the existing holds without creating new ones,
  // so it must never trigger a cancellation of components owned by the request
  // that actually reserved them.
  if (reserved.warnings.includes("idempotent_replay")) return

  const reservedComponentIds = reserved.reserved.map((component) => component.componentId)
  if (reservedComponentIds.length === 0) return

  try {
    await tripsService.cancelComponents(
      db,
      {
        envelopeId: snapshot.envelopeId,
        componentIds: reservedComponentIds,
        reason: release.reason,
        idempotencyKey: `proposal-accept-release:${release.quoteVersionId}:${release.reason}`,
        request: {
          initiatedBy: "public-proposal-accept",
          quoteVersionId: release.quoteVersionId,
        },
      },
      await options.cancelTripComponentsDeps(c),
    )
  } catch (error) {
    console.warn("[proposal] failed to release reservation after proposal accept conflict:", error)
  }
}

async function respondWithAcceptedProposal({
  c,
  options,
  snapshot,
  body,
  quoteVersionId,
  accepted,
  reserveWarnings,
}: {
  c: Context<OperatorProposalRouteEnv>
  options: QuoteProposalRoutesOptions
  snapshot: TripSnapshot
  body: z.infer<typeof acceptPublicProposalSchema>
  quoteVersionId: string
  accepted: AcceptQuoteVersionResult
  reserveWarnings: string[]
}) {
  const checkout = await startAcceptedProposalCheckout(c, options, snapshot, body, quoteVersionId)
  const checkoutWarnings = checkout
    ? checkout.failures.map((failure) => failure.reason)
    : ["checkout_start_failed"]

  return c.json({
    data: {
      status: "accepted",
      checkoutUrl: checkout?.target.checkoutUrl ?? null,
      paymentSessionId: checkout?.target.paymentSessionId ?? null,
      currency: checkout?.target.currency ?? accepted.quoteVersion.currency,
      totalAmountCents: checkout?.target.totalAmountCents ?? accepted.quoteVersion.totalAmountCents,
      warnings: [...reserveWarnings, ...(checkout?.warnings ?? []), ...checkoutWarnings],
    } satisfies AcceptPublicProposalResult,
  })
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
      await options.startCheckoutDeps(c),
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
  options: QuoteVersionSnapshotRoutesOptions,
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
