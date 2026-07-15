/** Bind the catalog booking Tool contract to the selected booking runtime. */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import {
  bookEntity,
  type CatalogBookingBookBody,
  type CatalogBookingProvenance,
  type CatalogBookingRouteModuleOptions,
  getOrderById,
  listOrders,
  OWNED_SOURCE_KIND,
  quoteEntity,
  serializeBookResult,
  serializeQuoteResult,
} from "./booking-engine/index.js"
import { catalogQuotesTable, type SelectCatalogQuote } from "./booking-engine/schema.js"
import type { CatalogBookingToolServices } from "./booking-tools.js"
import { readSourcedEntry } from "./services/sourced-entry-service.js"

export function createCatalogBookingToolServices(
  options: CatalogBookingRouteModuleOptions,
  c: Context,
): CatalogBookingToolServices {
  const booking = options.booking
  const db = booking.resolveDb(c)
  return {
    async quote(body) {
      const provenance = await resolveProvenance(c, booking, db, body)
      const correlationId = resolveCorrelationId(c, booking)
      const result = await quoteEntity(
        db,
        {
          registry: booking.resolveSourceRegistry(c),
          ownedHandlers: booking.resolveOwnedHandlers?.(c),
          contentEnricher: booking.contentEnricher,
          onEnricherError: booking.onContentEnricherError,
          evaluatePromotions: booking.resolveEvaluatePromotions?.({ c, db }),
        },
        {
          entityModule: body.entityModule,
          entityId: body.entityId,
          ...provenance,
          scope: {
            locale: body.scope?.locale ?? "en-GB",
            audience: body.scope?.audience ?? "staff",
            market: body.scope?.market ?? "default",
            currency: body.scope?.currency,
          },
          parameters: body.parameters,
          ttlMs: body.ttlMs,
          adapterContext: resolveAdapterContext(
            c,
            booking,
            db,
            "quote",
            provenance,
            correlationId,
            {
              entityModule: body.entityModule,
              entityId: body.entityId,
            },
          ),
        },
      )
      const transformed =
        (await booking.transformQuoteResult?.({ c, db, request: body, provenance, result })) ??
        result
      return serializeQuoteResult(transformed)
    },
    async commit(body) {
      const quoteId = body.quoteId
      if (!quoteId) throw new Error("quoteId is required")
      const quote = await loadQuote(db, quoteId)
      const provenance = quote
        ? {
            sourceKind: quote.source_kind,
            sourceProvider: quote.source_provider ?? undefined,
            sourceConnectionId: quote.source_connection_id ?? undefined,
            sourceRef: quote.source_ref ?? undefined,
          }
        : { sourceKind: "engine" }
      const request: CatalogBookingBookBody = { ...body, quoteId }
      const parameters =
        (await booking.prepareBookParameters?.({
          c,
          db,
          request,
          quoteId,
          quote,
          provenance,
          parameters: body.parameters ?? {},
        })) ?? body.parameters
      const result = await bookEntity(
        db,
        {
          registry: booking.resolveSourceRegistry(c),
          ownedHandlers: booking.resolveOwnedHandlers?.(c),
          captureSnapshotContent: booking.captureSnapshotContent,
        },
        {
          quoteId,
          bookingId: body.bookingId,
          party: body.party,
          paymentIntent: body.paymentIntent,
          parameters,
          idempotencyKey: body.idempotencyKey,
          adapterContext: resolveAdapterContext(
            c,
            booking,
            db,
            "book",
            provenance,
            resolveCorrelationId(c, booking),
          ),
          contentScope: booking.resolveContentScope?.({ c, db, body: request }),
        },
      )
      await booking.onCommitted?.({ c, db, request, result })
      const transformed =
        (await booking.transformBookResult?.({ c, db, request, result })) ?? result
      return serializeBookResult(transformed)
    },
    async listOrders(query) {
      const result = await listOrders(db, query)
      return { rows: result.rows.map(serializeOrder) }
    },
    async getOrder(id) {
      const row = await getOrderById(db, id)
      return row ? serializeOrder(row) : null
    },
  }
}

async function resolveProvenance(
  c: Context,
  options: CatalogBookingRouteModuleOptions["booking"],
  db: AnyDrizzleDb,
  body: Parameters<CatalogBookingToolServices["quote"]>[0],
): Promise<CatalogBookingProvenance> {
  if (body.sourceKind) {
    return {
      sourceKind: body.sourceKind,
      sourceProvider: body.sourceProvider,
      sourceConnectionId: body.sourceConnectionId,
      sourceRef: body.sourceRef,
    }
  }
  if (options.resolveEntityProvenance) {
    return options.resolveEntityProvenance({
      c,
      db,
      entityModule: body.entityModule,
      entityId: body.entityId,
    })
  }
  const row = await readSourcedEntry(db, body.entityModule, body.entityId)
  return row
    ? {
        sourceKind: row.source_kind,
        sourceProvider: row.source_provider ?? undefined,
        sourceConnectionId: row.source_connection_id ?? undefined,
        sourceRef: row.source_ref ?? undefined,
      }
    : { sourceKind: OWNED_SOURCE_KIND }
}

function resolveCorrelationId(
  c: Context,
  options: CatalogBookingRouteModuleOptions["booking"],
): string {
  return options.resolveCorrelationId?.(c) ?? c.req.header("x-request-id") ?? crypto.randomUUID()
}

function resolveAdapterContext(
  c: Context,
  options: CatalogBookingRouteModuleOptions["booking"],
  db: AnyDrizzleDb,
  operation: "quote" | "book",
  provenance: CatalogBookingProvenance,
  correlationId: string,
  entity?: { entityModule: string; entityId: string },
) {
  return (
    options.resolveAdapterContext?.({
      c,
      db,
      operation,
      ...entity,
      sourceKind: provenance.sourceKind,
      sourceConnectionId: provenance.sourceConnectionId,
      correlationId,
    }) ?? {
      connection_id: provenance.sourceConnectionId ?? provenance.sourceKind,
      correlation_id: correlationId,
    }
  )
}

async function loadQuote(
  db: AnyDrizzleDb,
  quoteId: string,
): Promise<SelectCatalogQuote | undefined> {
  const rows = (await db
    .select()
    .from(catalogQuotesTable)
    .where(eq(catalogQuotesTable.id, quoteId))
    .limit(1)) as SelectCatalogQuote[]
  return rows[0]
}

function serializeOrder(row: Awaited<ReturnType<typeof getOrderById>> & object) {
  return { ...row, captured_at: row.captured_at.toISOString() }
}
