/**
 * Demo `SourceAdapter` implementation for the catalog booking engine.
 *
 * Backs its data in two Postgres tables (`catalog_demo_inventory` +
 * `catalog_demo_orders`) in the same database the rest of the catalog
 * plane uses. There is no external upstream — `connect`/`disconnect`/
 * `getState` are essentially no-ops because the adapter is always
 * available when its tables exist.
 *
 * The adapter doubles as:
 *
 *   1. The reference implementation other adapter authors copy when they
 *      build a TUI, Hotelbeds, or Voyant Connect adapter — the shape of
 *      the lifecycle methods is identical, only the upstream changes.
 *   2. The integration-test fixture for the booking-engine orchestration.
 *      Tests register this adapter against a test DB, run quote/book/
 *      cancel through it, and assert the snapshot graph + webhook events
 *      look right without mocking anything.
 *   3. The "first-day demo" source. Operator templates seed a few
 *      inventory rows and the catalog page lights up with `source = Demo`
 *      rows that are clickable end-to-end, even before any external
 *      integration is wired.
 */

import type {
  AdapterCapabilities,
  CancelRequest,
  CancelResult,
  CatalogProjection,
  ConnectionState,
  DiscoveryCursor,
  DiscoveryPage,
  LiveResolveRequest,
  LiveResolveResult,
  ReserveRequest,
  ReserveResult,
  SourceAdapter,
  SourceAdapterContext,
} from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq, gt, inArray, sql } from "drizzle-orm"

import {
  type CatalogDemoInventoryRow,
  type CatalogDemoOrderRow,
  catalogDemoInventory,
  catalogDemoOrders,
} from "./schema.js"

/** Stable kind identifier emitted as `source.kind` on every projection. */
export const DEMO_SOURCE_KIND = "demo"

/**
 * Options accepted by `createDemoAdapter()`. The adapter is process-local
 * and stateful: every call uses the same Postgres handle, so callers pass
 * a `getDb` thunk to avoid pinning to a request-scoped instance.
 */
export interface DemoAdapterOptions {
  /**
   * Returns the Drizzle client to use. A thunk so adapters can be wired
   * at process start while the DB pool is created later (e.g. on first
   * request in Cloudflare Workers).
   */
  getDb: () => AnyDrizzleDb
  /**
   * Verticals this adapter feeds projections for. Defaults to `["products"]`
   * which is the tracer scope; expanding to other verticals just changes
   * which `entity_module` value the inventory rows declare.
   */
  verticals?: ReadonlyArray<string>
  /** Page size returned from `discover`. Defaults to 50. */
  discoveryPageSize?: number
}

/**
 * Construct a demo adapter instance. Call once at process start and
 * register on the booking engine's `SourceAdapterRegistry`.
 */
export function createDemoAdapter(options: DemoAdapterOptions): SourceAdapter {
  const verticals = options.verticals?.length ? Array.from(options.verticals) : ["products"]
  const pageSize = options.discoveryPageSize ?? 50
  const capabilities: AdapterCapabilities = {
    verticals,
    supportsLiveResolution: true,
    supportsDriftDetection: false,
    supportsBookingForwarding: true,
    postBookOperations: ["cancel", "status"],
  }

  return {
    kind: DEMO_SOURCE_KIND,
    capabilities,

    async connect(_ctx: SourceAdapterContext): Promise<void> {
      // No upstream to connect to — the adapter is "connected" the moment
      // its Postgres tables exist. Idempotent no-op.
    },

    async pause(_ctx: SourceAdapterContext): Promise<void> {
      // Same reason — there's nothing to pause. Provided for contract
      // compliance.
    },

    async disconnect(_ctx: SourceAdapterContext): Promise<void> {
      // Hard disconnect would normally release upstream credentials;
      // here it's a no-op. Inventory and orders survive deliberately so
      // snapshots stay queryable through the catalog plane's standard
      // disconnect lifecycle (foundation §5.10).
    },

    async getState(_ctx: SourceAdapterContext): Promise<ConnectionState> {
      // Always active — the adapter has no failure mode that would
      // produce `error` or `disconnected` short of the DB itself being
      // down, which is detectable elsewhere.
      return "active"
    },

    async discover(_ctx: SourceAdapterContext, cursor?: DiscoveryCursor): Promise<DiscoveryPage> {
      const db = options.getDb()
      const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0
      const rows = await db
        .select()
        .from(catalogDemoInventory)
        .where(inArray(catalogDemoInventory.entityModule, verticals))
        .orderBy(catalogDemoInventory.createdAt)
        .limit(pageSize + 1)
        .offset(offset)

      const hasMore = rows.length > pageSize
      const page = hasMore ? rows.slice(0, pageSize) : rows
      const projections: CatalogProjection[] = page.map((row) => ({
        entity_module: row.entityModule,
        entity_id: row.id,
        provenance: {
          source_kind: DEMO_SOURCE_KIND,
          source_freshness: "sync",
          source_ref: row.id,
        },
        fields: {
          "source.kind": DEMO_SOURCE_KIND,
          "source.ref": row.id,
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.available > 0 ? "active" : "inactive",
          activated: row.available > 0,
          visibility: "public",
          sellAmountCents: row.priceCents,
          sellCurrency: row.currency,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      }))

      return {
        projections,
        next_cursor: hasMore ? String(offset + pageSize) : undefined,
      }
    },

    async liveResolve(
      _ctx: SourceAdapterContext,
      request: LiveResolveRequest,
    ): Promise<LiveResolveResult> {
      const db = options.getDb()
      if (request.ids.length === 0) {
        return { values: {} }
      }
      const rows = await db
        .select()
        .from(catalogDemoInventory)
        .where(inArray(catalogDemoInventory.id, [...request.ids]))

      const byId = new Map<string, CatalogDemoInventoryRow>()
      for (const row of rows) byId.set(row.id, row)

      const values: Record<string, Record<string, unknown>> = {}
      const failed: Record<string, "timeout" | "not_found" | "unsupported" | "error"> = {}

      for (const id of request.ids) {
        const row = byId.get(id)
        if (!row || row.available <= 0) {
          failed[id] = "not_found"
          continue
        }
        values[id] = {
          available: true,
          priceCents: row.priceCents,
          currency: row.currency,
          name: row.name,
          metadata: row.metadata ?? null,
        }
      }

      return Object.keys(failed).length > 0 ? { values, failed } : { values }
    },

    async reserve(_ctx: SourceAdapterContext, request: ReserveRequest): Promise<ReserveResult> {
      const db = options.getDb()
      const inventory = await db
        .select()
        .from(catalogDemoInventory)
        .where(eq(catalogDemoInventory.id, request.entity_id))
        .limit(1)
      const row = inventory[0]
      if (!row || row.available <= 0) {
        return {
          upstream_ref: "",
          status: "failed",
          upstream_payload: { reason: "inventory_unavailable", entityId: request.entity_id },
        }
      }

      const intentType = readIntentType(request.payment_intent)
      const orderStatus = intentType === "hold" ? "held" : "confirmed"

      const orderId = await insertOrder(db, {
        inventoryId: row.id,
        entityId: row.id,
        entityModule: row.entityModule,
        status: orderStatus,
        pricedCents: row.priceCents,
        currency: row.currency,
        party: request.party ?? null,
        paymentIntent: request.payment_intent ?? null,
      })

      // Decrement availability so the same row can't be re-booked while
      // held/confirmed. Real adapters debit upstream inventory; the demo
      // mirrors that semantically with a counter.
      await db
        .update(catalogDemoInventory)
        .set({
          available: sql`${catalogDemoInventory.available} - 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(catalogDemoInventory.id, row.id), gt(catalogDemoInventory.available, 0)))

      return {
        upstream_ref: orderId,
        status: intentType === "hold" ? "held" : "confirmed",
        upstream_payload: {
          orderId,
          inventoryId: row.id,
          pricedCents: row.priceCents,
          currency: row.currency,
        },
      }
    },

    async cancel(_ctx: SourceAdapterContext, request: CancelRequest): Promise<CancelResult> {
      const db = options.getDb()
      const orders = await db
        .select()
        .from(catalogDemoOrders)
        .where(eq(catalogDemoOrders.id, request.upstream_ref))
        .limit(1)
      const order = orders[0]
      if (!order) {
        return { status: "refused" }
      }
      if (order.status === "cancelled") {
        return {
          status: "cancelled",
          refund_amount: order.pricedCents,
          refund_currency: order.currency,
        }
      }

      await db
        .update(catalogDemoOrders)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledReason: request.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(catalogDemoOrders.id, order.id))

      // Restore inventory so the demo doesn't drift to zero across
      // back-to-back book/cancel cycles. Production adapters wouldn't do
      // this — upstream cancels typically don't re-add stock.
      if (order.inventoryId) {
        await db
          .update(catalogDemoInventory)
          .set({
            available: sql`${catalogDemoInventory.available} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(catalogDemoInventory.id, order.inventoryId))
      }

      return {
        status: "cancelled",
        refund_amount: order.pricedCents,
        refund_currency: order.currency,
      }
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function readIntentType(intent: ReserveRequest["payment_intent"]): string | undefined {
  if (!intent || typeof intent !== "object") return undefined
  const t = (intent as Record<string, unknown>).type
  return typeof t === "string" ? t : undefined
}

interface InsertOrderInput {
  inventoryId: string
  entityId: string
  entityModule: string
  status: string
  pricedCents: number
  currency: string
  party: Record<string, unknown> | null
  paymentIntent: Record<string, unknown> | null
}

async function insertOrder(db: AnyDrizzleDb, input: InsertOrderInput): Promise<string> {
  const { newId } = await import("@voyantjs/db/lib/typeid")
  const id = newId("catalog_demo_orders")
  const inserted = (await db
    .insert(catalogDemoOrders)
    .values({
      id,
      inventoryId: input.inventoryId,
      entityId: input.entityId,
      entityModule: input.entityModule,
      status: input.status,
      pricedCents: input.pricedCents,
      currency: input.currency,
      party: input.party,
      paymentIntent: input.paymentIntent,
    })
    .returning()) as CatalogDemoOrderRow[]
  if (!inserted[0]) {
    throw new Error("createDemoAdapter.reserve: insert returned no rows")
  }
  return inserted[0].id
}
