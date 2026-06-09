import {
  crmService,
  type QuoteVersion,
  QuoteVersionConflictError,
  sendQuoteVersionSchema,
} from "@voyantjs/crm"
import { parseOptionalJsonBody, type VoyantDb } from "@voyantjs/hono"
import {
  type StartCheckoutResult,
  TravelComposerInvariantError,
  type TripSnapshot,
  travelComposerService,
} from "@voyantjs/travel-composer"
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
import { createReserveTripDeps, createStartCheckoutDeps } from "./travel-composer-runtime"

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
  Awaited<ReturnType<typeof crmService.getQuoteVersionProposal>>
>

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
    const quoteVersion = await crmService.sendQuoteVersion(
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
  await crmService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await crmService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }

  const viewedQuoteVersion =
    proposal.quoteVersion.status === "sent"
      ? await crmService.markQuoteVersionViewed(db, quoteVersionId)
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
  await crmService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await crmService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }

  try {
    const quoteVersion = await crmService.declineQuoteVersion(db, quoteVersionId)
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
  await crmService.expireQuoteVersionIfPastValidUntil(db, quoteVersionId)
  const proposal = await crmService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposal) return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "draft") return c.json({ error: "Proposal not found" }, 404)
  if (proposal.quoteVersion.status === "superseded") {
    return c.json({ error: "Proposal has been superseded" }, 410)
  }
  if (proposal.quoteVersion.status !== "sent") {
    return c.json({ error: "Proposal can no longer be accepted" }, 409)
  }
  if (!proposal.quoteVersion.tripSnapshotId) {
    return c.json({ error: "Proposal has no frozen Trip snapshot" }, 409)
  }

  try {
    const snapshot = await travelComposerService.getTripSnapshotById(
      db,
      proposal.quoteVersion.tripSnapshotId,
    )
    if (!snapshot) return c.json({ error: "Proposal Trip snapshot not found" }, 409)

    assertProposalMatchesTripSnapshot(proposal, snapshot)

    const reserveIdempotencyKey = `proposal-accept-reserve:${quoteVersionId}:${
      body.idempotencyKey ?? "default"
    }`
    const reserved = await travelComposerService.reserveTrip(
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
      return c.json(
        {
          error: "Proposal could not be reserved",
          failures: reserved.failures.map(({ code, reason }) => ({ code, reason })),
        },
        409,
      )
    }

    const accepted = await crmService.acceptQuoteVersion(db, quoteVersionId, {})
    if (!accepted) return c.json({ error: "Proposal not found" }, 404)

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
        totalAmountCents:
          checkout?.target.totalAmountCents ?? accepted.quoteVersion.totalAmountCents,
        warnings: [...reserved.warnings, ...(checkout?.warnings ?? []), ...checkoutWarnings],
      } satisfies AcceptPublicProposalResult,
    })
  } catch (error) {
    if (error instanceof QuoteVersionConflictError) {
      return c.json({ error: error.message }, 409)
    }
    if (error instanceof TravelComposerInvariantError) {
      return c.json({ error: error.message }, error.message.includes("was not found") ? 404 : 409)
    }
    throw error
  }
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
