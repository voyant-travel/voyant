import { crmService, QuoteVersionConflictError } from "@voyantjs/crm"
import type { VoyantDb } from "@voyantjs/hono"
import {
  type ReserveTripResult,
  type StartCheckoutResult,
  type Trip,
  type TripSnapshot,
  travelComposerService,
} from "@voyantjs/travel-composer"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { z } from "zod"
import { operatorPostgresDb } from "./operator-runtime-adapter"
import { tripSnapshotToQuoteVersionApply } from "./quote-version-snapshot-routes"
import {
  createCancelTripComponentsDeps,
  createReserveTripDeps,
  createStartCheckoutDeps,
} from "./travel-composer-runtime"

type OperatorProposalRouteEnv = {
  Bindings: Record<string, unknown>
  Variables: {
    db: VoyantDb
    userId?: string
  }
}

type QuoteVersionProposalReadModel = NonNullable<
  Awaited<ReturnType<typeof crmService.getQuoteVersionProposal>>
>
type AcceptQuoteVersionResult = NonNullable<
  Awaited<ReturnType<typeof crmService.acceptQuoteVersion>>
>

export type PreparedAcceptResult =
  | {
      kind: "accepted"
      accepted: AcceptQuoteVersionResult
      snapshot: TripSnapshot
      warnings: string[]
    }
  | {
      kind: "prepared"
      snapshot: TripSnapshot
    }
  | { kind: "response"; response: Response }

export type FinalizedAcceptResult =
  | {
      kind: "accepted"
      accepted: AcceptQuoteVersionResult
    }
  | { kind: "response"; response: Response }

export interface AcceptPublicProposalResult {
  status: "accepted"
  checkoutUrl: string | null
  paymentSessionId: string | null
  currency: string
  totalAmountCents: number
  warnings: string[]
}

export const acceptPublicProposalSchema = z.object({
  intent: z.enum(["card", "bank_transfer"]).default("card"),
  idempotencyKey: z.string().min(1).max(120).optional(),
})

export async function respondWithAcceptedProposal({
  c,
  snapshot,
  body,
  quoteVersionId,
  accepted,
  reserveWarnings,
}: {
  c: Context<OperatorProposalRouteEnv>
  snapshot: TripSnapshot
  body: z.infer<typeof acceptPublicProposalSchema>
  quoteVersionId: string
  accepted: AcceptQuoteVersionResult
  reserveWarnings: string[]
}) {
  const checkout = await startAcceptedProposalCheckout(c, snapshot, body, quoteVersionId)
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

export async function reservePreparedPublicProposal(
  c: Context<OperatorProposalRouteEnv>,
  db: PostgresJsDatabase,
  snapshot: TripSnapshot,
  body: z.infer<typeof acceptPublicProposalSchema>,
  quoteVersionId: string,
): Promise<ReserveTripResult> {
  const reserveIdempotencyKey = `proposal-accept-reserve:${quoteVersionId}:${
    body.idempotencyKey ?? "default"
  }`

  return travelComposerService.reserveTrip(
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
}

export async function releaseAcceptedProposalReservation(
  c: Context<OperatorProposalRouteEnv>,
  db: PostgresJsDatabase,
  snapshot: TripSnapshot,
  reserved: ReserveTripResult,
  options: {
    quoteVersionId: string
    reason: string
  },
) {
  const reservedComponentIds = reserved.reserved.map((component) => component.componentId)
  if (reservedComponentIds.length === 0) return

  try {
    await travelComposerService.cancelComponents(
      db,
      {
        envelopeId: snapshot.envelopeId,
        componentIds: reservedComponentIds,
        reason: options.reason,
        idempotencyKey: `proposal-accept-release:${options.quoteVersionId}:${options.reason}`,
        request: {
          initiatedBy: "public-proposal-accept",
          quoteVersionId: options.quoteVersionId,
        },
      },
      createCancelTripComponentsDeps(c),
    )
  } catch (error) {
    console.warn("[proposal] failed to release reservation after proposal accept conflict:", error)
  }
}

export async function preparePublicProposalAcceptWithQuoteLock({
  c,
  db,
  quoteId,
  quoteVersionId,
}: {
  c: Context<OperatorProposalRouteEnv>
  db: PostgresJsDatabase
  quoteId: string
  quoteVersionId: string
}): Promise<PreparedAcceptResult> {
  await lockQuoteAccept(db, quoteId)
  await crmService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await crmService.getQuoteVersionProposal(db, quoteVersionId)

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

  const snapshot = await travelComposerService.getTripSnapshotById(
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
    const accepted = await crmService.acceptQuoteVersion(db, quoteVersionId, {})
    if (!accepted) {
      return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }
    }

    return { kind: "accepted", accepted, snapshot, warnings: [] }
  }

  const liveTrip = await travelComposerService.getTrip(db, snapshot.envelopeId)
  if (!liveTrip) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip envelope not found" }, 409),
    }
  }
  assertLiveTripMatchesSnapshot(liveTrip, snapshot)

  return { kind: "prepared", snapshot }
}

export async function finalizePublicProposalAcceptWithQuoteLock({
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
  await crmService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await crmService.getQuoteVersionProposal(db, quoteVersionId)

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
    const accepted = await crmService.acceptQuoteVersion(db, quoteVersionId, {})
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
  if (proposal.quoteVersion.tripSnapshotId !== snapshot.id) {
    return {
      kind: "response",
      response: c.json({ error: "Proposal Trip snapshot changed before acceptance" }, 409),
    }
  }
  assertProposalMatchesTripSnapshot(proposal, snapshot)

  const accepted = await crmService.acceptQuoteVersion(db, quoteVersionId, {})
  if (!accepted) return { kind: "response", response: c.json({ error: "Proposal not found" }, 404) }

  return { kind: "accepted", accepted }
}

function lockQuoteAccept(db: PostgresJsDatabase, quoteId: string) {
  return db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${quoteAcceptLockKey(quoteId)}, 0))`,
  )
}

function quoteAcceptLockKey(quoteId: string) {
  return `quote-accept:${quoteId}`
}

async function startAcceptedProposalCheckout(
  c: Context<OperatorProposalRouteEnv>,
  snapshot: TripSnapshot,
  body: z.infer<typeof acceptPublicProposalSchema>,
  quoteVersionId: string,
): Promise<StartCheckoutResult | null> {
  try {
    return await travelComposerService.startCheckout(
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
