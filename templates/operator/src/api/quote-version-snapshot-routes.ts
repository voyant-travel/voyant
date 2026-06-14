import { parseJsonBody, type VoyantDb } from "@voyantjs/hono"
import {
  type QuoteVersion,
  QuoteVersionConflictError,
  type QuoteVersionLine,
  quotesService,
} from "@voyantjs/quotes"
import {
  type TripSnapshot,
  type TripSnapshotProposalLine,
  TripsInvariantError,
  tripsService,
} from "@voyantjs/trips"
import type { Context, Hono } from "hono"
import { z } from "zod"
import { operatorPostgresDb } from "./operator-runtime-adapter"

type OperatorQuoteVersionSnapshotRouteEnv = {
  Variables: {
    db: VoyantDb
    userId?: string
  }
}

type ApplyTripSnapshotPayload = Parameters<typeof quotesService.applyTripSnapshotToQuoteVersion>[2]

export type ApplyTripSnapshotToQuoteVersionResult = {
  snapshot: TripSnapshot
  quoteVersion: QuoteVersion
  lines: QuoteVersionLine[]
}

const freezeQuoteVersionSnapshotBodySchema = z.object({
  createdBy: z.string().min(1).nullable().optional(),
})

export function mountOperatorQuoteVersionSnapshotRoutes(
  hono: Hono<OperatorQuoteVersionSnapshotRouteEnv>,
): void {
  hono.post(
    "/v1/admin/trips/:envelopeId/quote-versions/:quoteVersionId/snapshot",
    handleFreezeQuoteVersionSnapshot,
  )
}

export async function handleFreezeQuoteVersionSnapshot(
  c: Context<OperatorQuoteVersionSnapshotRouteEnv>,
) {
  const envelopeId = c.req.param("envelopeId")
  const quoteVersionId = c.req.param("quoteVersionId")
  if (!envelopeId) return c.json({ error: "Trip envelope id is required" }, 400)
  if (!quoteVersionId) return c.json({ error: "Quote version id is required" }, 400)

  const db = operatorPostgresDb(c.get("db"))
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
