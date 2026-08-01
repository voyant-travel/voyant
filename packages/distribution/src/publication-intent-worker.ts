import type { CatalogProjectionRuntime } from "@voyant-travel/catalog/projection-runtime"
import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { and, asc, eq, gt, lt, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  type DistributionPublicationIntentWorkerDeps,
  distributionPublicationIntentWorkerRuntimePort,
} from "./publication-intent-runtime-port.js"
import { publicationProductsRef } from "./publication-product-ref.js"
import { channelProductPublications, channels } from "./schema.js"

export {
  type DistributionPublicationIntentWorkerDeps,
  type DistributionPublicationIntentWorkerRuntime,
  distributionPublicationIntentWorkerRuntimePort,
} from "./publication-intent-runtime-port.js"

const DEFAULT_LEASE_MS = 2 * 60 * 1_000
const DEFAULT_MAX_INTENTS = 25
const DEFAULT_PRODUCT_BATCH_SIZE = 100
const DEFAULT_CHANNEL_BATCH_SIZE = 100
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 60_000

type ClaimedIntent = {
  id: string
  channelId: string | null
  kind: "product" | "supplier" | "catalog"
  productId: string | null
  supplierId: string | null
  cursor: string | null
  metadata: unknown
  attempts: number
  leaseOwner: string
}

export interface PublicationIntentWorkerOptions {
  leaseOwner?: string
  leaseMs?: number
  maxIntents?: number
  productBatchSize?: number
  channelBatchSize?: number
  maxAttempts?: number
  retryDelayMs?: number
}

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] })?.rows ?? [])
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function claimIntent(
  db: PostgresJsDatabase,
  leaseOwner: string,
  options: Required<Pick<PublicationIntentWorkerOptions, "leaseMs" | "maxAttempts">>,
) {
  // agent-quality: raw SQL required for atomic lease claim with FOR UPDATE SKIP LOCKED.
  const result = await db.execute(sql<ClaimedIntent>`
    WITH candidate AS (
      SELECT id
      FROM channel_publication_reindex_intents
      WHERE status IN ('pending', 'processing', 'failed')
        AND attempts < ${options.maxAttempts}
        AND next_attempt_at <= now()
        AND (
          status <> 'processing'
          OR lease_owner = ${leaseOwner}
          OR lease_until IS NULL
          OR lease_until < now()
        )
      ORDER BY requested_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE channel_publication_reindex_intents intent
    SET status = 'processing',
        lease_owner = ${leaseOwner},
        lease_until = now() + (${options.leaseMs} * interval '1 millisecond'),
        processing_started_at = COALESCE(intent.processing_started_at, now()),
        updated_at = now(),
        last_error = NULL
    FROM candidate
    WHERE intent.id = candidate.id
    RETURNING
      intent.id,
      intent.channel_id AS "channelId",
      intent.kind,
      intent.product_id AS "productId",
      intent.supplier_id AS "supplierId",
      intent.cursor,
      intent.metadata,
      intent.attempts,
      intent.lease_owner AS "leaseOwner"
  `)

  return rowsOf<ClaimedIntent>(result)[0] ?? null
}

async function completeIntent(db: PostgresJsDatabase, intent: ClaimedIntent) {
  // agent-quality: raw SQL keeps lease-owner compare-and-clear atomic.
  await db.execute(sql`
    UPDATE channel_publication_reindex_intents
    SET status = 'completed',
        cursor = NULL,
        lease_owner = NULL,
        lease_until = NULL,
        completed_at = now(),
        updated_at = now()
    WHERE id = ${intent.id}
      AND status = 'processing'
      AND lease_owner = ${intent.leaseOwner}
  `)
}

async function checkpointIntent(
  db: PostgresJsDatabase,
  intent: ClaimedIntent,
  cursor: string,
  leaseMs: number,
) {
  // Keep ownership while cursoring. A concurrent enqueue may legitimately create
  // a fresh pending row for the same subject; transitioning this row back to
  // pending would race that insert and violate the partial unique index.
  await db.execute(sql`
    UPDATE channel_publication_reindex_intents
    SET cursor = ${cursor},
        lease_until = now() + (${leaseMs} * interval '1 millisecond'),
        next_attempt_at = now(),
        updated_at = now()
    WHERE id = ${intent.id}
      AND status = 'processing'
      AND lease_owner = ${intent.leaseOwner}
  `)
}

async function failIntent(
  db: PostgresJsDatabase,
  intent: ClaimedIntent,
  input: { error: string; retryDelayMs: number },
) {
  // Failed rows are retryable by claimIntent until maxAttempts. Keeping the row
  // out of `pending` avoids racing a concurrently enqueued pending successor.
  await db.execute(sql`
    UPDATE channel_publication_reindex_intents
    SET status = 'failed',
        attempts = attempts + 1,
        lease_owner = NULL,
        lease_until = NULL,
        next_attempt_at = now() + (${input.retryDelayMs} * interval '1 millisecond'),
        last_error = ${input.error},
        updated_at = now()
    WHERE id = ${intent.id}
      AND status = 'processing'
      AND lease_owner = ${intent.leaseOwner}
  `)
}

async function listSupplierProductIds(
  db: PostgresJsDatabase,
  input: { supplierId: string; afterId?: string | null; limit: number },
) {
  const result = await db
    .select({ id: publicationProductsRef.id })
    .from(publicationProductsRef)
    .where(
      input.afterId
        ? and(
            eq(publicationProductsRef.supplierId, input.supplierId),
            gt(publicationProductsRef.id, input.afterId),
          )
        : eq(publicationProductsRef.supplierId, input.supplierId),
    )
    .orderBy(asc(publicationProductsRef.id))
    .limit(input.limit)

  return result.map(({ id }) => id)
}

async function listVisibleProductIdsPage(
  db: PostgresJsDatabase,
  input: {
    after: CatalogBackfillBound | null
    upper: CatalogBackfillBound | null
    cutoverAt: Date
    limit: number
  },
) {
  const result = await db
    .select({ id: publicationProductsRef.id, createdAt: publicationProductsRef.createdAt })
    .from(publicationProductsRef)
    .where(
      and(
        eq(publicationProductsRef.status, "active"),
        eq(publicationProductsRef.visibility, "public"),
        lte(publicationProductsRef.updatedAt, input.cutoverAt),
        input.upper
          ? or(
              lt(publicationProductsRef.createdAt, input.upper.createdAt),
              and(
                eq(publicationProductsRef.createdAt, input.upper.createdAt),
                lte(publicationProductsRef.id, input.upper.id),
              ),
            )
          : sql`false`,
        input.after
          ? or(
              gt(publicationProductsRef.createdAt, input.after.createdAt),
              and(
                eq(publicationProductsRef.createdAt, input.after.createdAt),
                gt(publicationProductsRef.id, input.after.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(publicationProductsRef.createdAt), asc(publicationProductsRef.id))
    .limit(input.limit)
  return result
}

async function listActiveChannelIdsPage(
  db: PostgresJsDatabase,
  input: {
    after: CatalogBackfillBound | null
    upper: CatalogBackfillBound | null
    cutoverAt: Date
    limit: number
  },
) {
  const rows = await db
    .select({ id: channels.id, createdAt: channels.createdAt })
    .from(channels)
    .where(
      and(
        eq(channels.status, "active"),
        lte(channels.updatedAt, input.cutoverAt),
        input.upper
          ? or(
              lt(channels.createdAt, input.upper.createdAt),
              and(eq(channels.createdAt, input.upper.createdAt), lte(channels.id, input.upper.id)),
            )
          : sql`false`,
        input.after
          ? or(
              gt(channels.createdAt, input.after.createdAt),
              and(eq(channels.createdAt, input.after.createdAt), gt(channels.id, input.after.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(channels.createdAt), asc(channels.id))
    .limit(input.limit)
  return rows
}

async function publishPriorVisibleProduct(
  db: PostgresJsDatabase,
  input: { productId: string; channelIds: readonly string[] },
) {
  if (input.channelIds.length === 0) return
  await db
    .insert(channelProductPublications)
    .values(
      input.channelIds.map((channelId) => ({
        channelId,
        productId: input.productId,
        decision: "include" as const,
        reason: "Backfilled from prior active public catalog visibility during publication cutover.",
        createdBy: "system:worker:prior-visible-catalog-backfill",
        updatedBy: "system:worker:prior-visible-catalog-backfill",
        metadata: { source: "prior_active_public_catalog" },
      })),
    )
    .onConflictDoNothing()
}

type CatalogBackfillBound = {
  id: string
  createdAt: Date
}

type CatalogBackfillCursor = {
  afterProduct: CatalogBackfillBound | null
  product: CatalogBackfillBound | null
  afterChannel: CatalogBackfillBound | null
}

function parseCatalogCursor(cursor: string | null): CatalogBackfillCursor {
  if (!cursor) return { afterProduct: null, product: null, afterChannel: null }
  const parsed = JSON.parse(cursor) as Partial<CatalogBackfillCursor>
  return {
    afterProduct: parseCatalogBound(parsed.afterProduct),
    product: parseCatalogBound(parsed.product),
    afterChannel: parseCatalogBound(parsed.afterChannel),
  }
}

function parseCatalogBound(value: unknown): CatalogBackfillBound | null {
  if (!value || typeof value !== "object") return null
  const input = value as { id?: unknown; createdAt?: unknown }
  if (typeof input.id !== "string" || typeof input.createdAt !== "string") return null
  const createdAt = new Date(input.createdAt)
  return Number.isNaN(createdAt.valueOf()) ? null : { id: input.id, createdAt }
}

function parseCatalogCutoverBounds(metadata: unknown) {
  const cutover =
    metadata && typeof metadata === "object"
      ? (metadata as { cutover?: unknown }).cutover
      : undefined
  const bounds = cutover && typeof cutover === "object" ? cutover : {}
  return {
    at: parseCatalogTimestamp((bounds as { at?: unknown }).at),
    product: parseCatalogBound((bounds as { product?: unknown }).product),
    channel: parseCatalogBound((bounds as { channel?: unknown }).channel),
  }
}

function parseCatalogTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.valueOf()) ? null : timestamp
}

async function processCatalogBackfillIntent(
  db: PostgresJsDatabase,
  projection: CatalogProjectionRuntime,
  intent: ClaimedIntent,
  options: { productBatchSize: number; channelBatchSize: number; leaseMs: number },
) {
  const cursor = parseCatalogCursor(intent.cursor)
  const bounds = parseCatalogCutoverBounds(intent.metadata)
  // A catalog intent without the migration's immutable cutover watermark must
  // never widen into "everything visible now". Complete it without writes.
  if (!bounds.at || !bounds.product) {
    await completeIntent(db, intent)
    return
  }
  const product =
    cursor.product ??
    (
      await listVisibleProductIdsPage(db, {
        after: cursor.afterProduct,
        upper: bounds.product,
        cutoverAt: bounds.at,
        limit: 1,
      })
    )[0]
  if (!product) {
    await completeIntent(db, intent)
    return
  }

  const channelRows = await listActiveChannelIdsPage(db, {
    after: cursor.product ? cursor.afterChannel : null,
    upper: bounds.channel,
    cutoverAt: bounds.at,
    limit: options.channelBatchSize,
  })
  await publishPriorVisibleProduct(db, {
    productId: product.id,
    channelIds: channelRows.map(({ id }) => id),
  })

  const lastChannel = channelRows[channelRows.length - 1]
  if (channelRows.length === options.channelBatchSize && lastChannel) {
    await checkpointIntent(
      db,
      intent,
      JSON.stringify({
        afterProduct: cursor.afterProduct,
        product,
        afterChannel: lastChannel,
      } satisfies CatalogBackfillCursor),
      options.leaseMs,
    )
    return
  }

  await projection.reindexEntity({ entityModule: "products", entityId: product.id })
  await checkpointIntent(
    db,
    intent,
    JSON.stringify({
      afterProduct: product,
      product: null,
      afterChannel: null,
    } satisfies CatalogBackfillCursor),
    options.leaseMs,
  )
}

async function processIntent(
  db: PostgresJsDatabase,
  projection: CatalogProjectionRuntime,
  intent: ClaimedIntent,
  options: Required<
    Pick<
      PublicationIntentWorkerOptions,
      "productBatchSize" | "channelBatchSize" | "retryDelayMs" | "leaseMs"
    >
  >,
) {
  try {
    if (intent.kind === "product") {
      if (!intent.productId) throw new Error("product intent is missing productId")
      await projection.reindexEntity({ entityModule: "products", entityId: intent.productId })
      await completeIntent(db, intent)
      return
    }

    if (intent.kind === "catalog") {
      await processCatalogBackfillIntent(db, projection, intent, options)
      return
    }

    const productIds = intent.supplierId
      ? await listSupplierProductIds(db, {
          supplierId: intent.supplierId,
          afterId: intent.cursor,
          limit: options.productBatchSize,
        })
      : (() => {
          throw new Error("supplier intent is missing supplierId")
        })()
    if (productIds.length === 0) {
      await completeIntent(db, intent)
      return
    }

    for (const productId of productIds) {
      await projection.reindexEntity({ entityModule: "products", entityId: productId })
    }

    const lastProductId = productIds[productIds.length - 1]
    if (productIds.length < options.productBatchSize || !lastProductId) {
      await completeIntent(db, intent)
      return
    }

    await checkpointIntent(db, intent, lastProductId, options.leaseMs)
  } catch (error) {
    await failIntent(db, intent, {
      error: errorMessage(error),
      retryDelayMs: options.retryDelayMs,
    })
    throw error
  }
}

export async function drainPublicationReindexIntents(
  deps: DistributionPublicationIntentWorkerDeps,
  options: PublicationIntentWorkerOptions = {},
) {
  const db = deps.db as PostgresJsDatabase
  const leaseOwner = options.leaseOwner ?? crypto.randomUUID()
  const settings = {
    leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
    maxIntents: options.maxIntents ?? DEFAULT_MAX_INTENTS,
    productBatchSize: options.productBatchSize ?? DEFAULT_PRODUCT_BATCH_SIZE,
    channelBatchSize: options.channelBatchSize ?? DEFAULT_CHANNEL_BATCH_SIZE,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  }
  let processed = 0

  while (processed < settings.maxIntents) {
    const intent = await claimIntent(db, leaseOwner, settings)
    if (!intent) break
    try {
      await processIntent(db, deps.projection, intent, settings)
      processed += 1
    } catch (error) {
      deps.report?.("[distribution-publication-intents] intent failed", {
        intentId: intent.id,
        error: errorMessage(error),
      })
      processed += 1
    }
  }

  return { processed }
}

export async function runDistributionPublicationIntentWorkerJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(distributionPublicationIntentWorkerRuntimePort)
  await runtime.withDeps(context.bindings, (deps) => drainPublicationReindexIntents(deps))
}
