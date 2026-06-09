import {
  crmService,
  type QuoteVersion,
  QuoteVersionConflictError,
  sendQuoteVersionSchema,
} from "@voyantjs/crm"
import { parseOptionalJsonBody, type VoyantDb } from "@voyantjs/hono"
import { TravelComposerInvariantError } from "@voyantjs/travel-composer"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { operatorPostgresDb } from "./operator-runtime-adapter"
import { resolvePublicCheckoutBaseUrlFromBindings } from "./payment-config"
import {
  acceptPublicProposalSchema,
  type FinalizedAcceptResult,
  finalizePublicProposalAcceptWithQuoteLock,
  preparePublicProposalAcceptWithQuoteLock,
  releaseAcceptedProposalReservation,
  reservePreparedPublicProposal,
  respondWithAcceptedProposal,
} from "./proposal-accept-helpers"
import {
  getOperatorSettings,
  type PublicOperatorProfile,
  toPublicOperatorSettings,
} from "./settings"

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

type QuoteVersionProposalReadModel = NonNullable<
  Awaited<ReturnType<typeof crmService.getQuoteVersionProposal>>
>

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
  const proposalForLock = await crmService.getQuoteVersionProposal(db, quoteVersionId)

  if (!proposalForLock) return c.json({ error: "Proposal not found" }, 404)

  try {
    const prepared = await db.transaction((tx) =>
      preparePublicProposalAcceptWithQuoteLock({
        c,
        db: tx as PostgresJsDatabase,
        quoteId: proposalForLock.quote.id,
        quoteVersionId,
      }),
    )
    if (prepared.kind === "response") return prepared.response
    if (prepared.kind === "accepted") {
      return respondWithAcceptedProposal({
        c,
        snapshot: prepared.snapshot,
        body,
        quoteVersionId,
        accepted: prepared.accepted,
        reserveWarnings: prepared.warnings,
      })
    }

    // Sourced adapters may create upstream holds, so reserve on the durable
    // request DB before the final short CRM accept transaction.
    const reserved = await reservePreparedPublicProposal(
      c,
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

    let finalized: FinalizedAcceptResult
    try {
      finalized = await db.transaction((tx) =>
        finalizePublicProposalAcceptWithQuoteLock({
          c,
          db: tx as PostgresJsDatabase,
          quoteId: proposalForLock.quote.id,
          quoteVersionId,
          snapshot: prepared.snapshot,
        }),
      )
    } catch (error) {
      await releaseAcceptedProposalReservation(c, db, prepared.snapshot, reserved, {
        quoteVersionId,
        reason: "quote_accept_failed",
      })
      throw error
    }

    if (finalized.kind === "response") {
      await releaseAcceptedProposalReservation(c, db, prepared.snapshot, reserved, {
        quoteVersionId,
        reason: "quote_accept_failed",
      })
      return finalized.response
    }

    return respondWithAcceptedProposal({
      c,
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
    if (error instanceof TravelComposerInvariantError) {
      return c.json({ error: error.message }, error.message.includes("was not found") ? 404 : 409)
    }
    throw error
  }
}
