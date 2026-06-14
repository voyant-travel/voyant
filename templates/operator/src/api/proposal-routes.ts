// agent-quality: file-size exception -- owner: operator; existing route module stays co-located until a dedicated split preserves behavior and tests.

import { parseOptionalJsonBody, type VoyantDb } from "@voyantjs/hono"
import {
  type QuoteVersion,
  QuoteVersionConflictError,
  quotesService,
  sendQuoteVersionSchema,
} from "@voyantjs/quotes"
import {
  type StartCheckoutResult,
  type Trip,
  TripComposerInvariantError,
  type TripSnapshot,
  tripComposerService,
} from "@voyantjs/trip-composer"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"
import { operatorPostgresDb } from "./operator-runtime-adapter"
import { resolvePublicCheckoutBaseUrlFromBindings } from "./payment-config"
import { tripSnapshotToQuoteVersionApply } from "./quote-version-snapshot-routes"
import {
  getOperatorSettings,
  type PublicOperatorProfile,
  toPublicOperatorSettings,
} from "./settings"
import { createReserveTripDeps, createStartCheckoutDeps } from "./trip-composer-runtime"

type OperatorProposalRouteEnv = {
  Bindings: Record<string, unknown>
  Variables: {
    db: VoyantDb
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
  operator: PublicOperatorProfile | null
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
    operator: PublicOperatorProfile | null
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

export function mountOperatorProposalRoutes(hono: Hono<OperatorProposalRouteEnv>): void {
  hono.post("/v1/admin/quote-versions/:quoteVersionId/send", handleSendQuoteVersion)
  hono.get("/v1/public/proposals/:quoteVersionId", handleGetPublicProposal)
  hono.post("/v1/public/proposals/:quoteVersionId/accept", handleAcceptPublicProposal)
  hono.post("/v1/public/proposals/:quoteVersionId/decline", handleDeclinePublicProposal)
}

export async function handleSendQuoteVersion(c: Context<OperatorProposalRouteEnv>) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  try {
    const quoteVersion = await quotesService.sendQuoteVersion(
      operatorPostgresDb(c.get("db")),
      quoteVersionId,
      await parseOptionalJsonBody(c, sendQuoteVersionSchema),
    )
    if (!quoteVersion) return c.json({ error: "Quote Version not found" }, 404)

    return c.json({
      data: {
        quoteVersion,
        proposalUrl: buildQuoteVersionProposalUrl(quoteVersion.id, {
          baseUrl: resolvePublicCheckoutBaseUrlFromBindings(c.env ?? {}),
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

export async function handleGetPublicProposal(c: Context<OperatorProposalRouteEnv>) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const db = operatorPostgresDb(c.get("db"))
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
  const operatorSettings = await getOperatorSettings(db)

  return c.json({
    data: toPublicQuoteVersionProposal(proposal, {
      quoteVersion: viewedQuoteVersion,
      operator: operatorSettings ? toPublicOperatorSettings(operatorSettings) : null,
      proposalUrl: buildQuoteVersionProposalUrl(quoteVersionId, {
        baseUrl: resolvePublicCheckoutBaseUrlFromBindings(c.env ?? {}),
      }),
    }),
  })
}

export async function handleDeclinePublicProposal(c: Context<OperatorProposalRouteEnv>) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const db = operatorPostgresDb(c.get("db"))
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

export async function handleAcceptPublicProposal(c: Context<OperatorProposalRouteEnv>) {
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!quoteVersionId) return c.json({ error: "Quote Version id is required" }, 400)

  const body = await parseOptionalJsonBody(c, acceptPublicProposalSchema)
  const db = operatorPostgresDb(c.get("db"))
  const proposalForLock = await quotesService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposalForLock) return c.json({ error: "Proposal not found" }, 404)

  try {
    const lockedResult = await db.transaction((tx) =>
      acceptPublicProposalWithQuoteLock({
        c,
        db: tx as PostgresJsDatabase,
        quoteId: proposalForLock.quote.id,
        quoteVersionId,
        body,
      }),
    )
    if (lockedResult.kind === "response") return lockedResult.response

    const checkout = await startAcceptedProposalCheckout(
      c,
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
    if (error instanceof TripComposerInvariantError) {
      return c.json({ error: error.message }, error.message.includes("was not found") ? 404 : 409)
    }
    throw error
  }
}

async function acceptPublicProposalWithQuoteLock({
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

  const snapshot = await tripComposerService.getTripSnapshotById(
    db,
    proposal.quoteVersion.tripSnapshotId,
  )
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

  const liveTrip = await tripComposerService.getTrip(db, snapshot.envelopeId)
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
  const reserved = await tripComposerService.reserveTrip(
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
    createReserveTripDeps(c),
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
    // agent-quality: raw-sql reviewed -- owner: operator; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
  snapshot: TripSnapshot,
  body: z.infer<typeof acceptPublicProposalSchema>,
  quoteVersionId: string,
): Promise<StartCheckoutResult | null> {
  try {
    return await tripComposerService.startCheckout(
      operatorPostgresDb(c.get("db")),
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
      createStartCheckoutDeps(c),
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
