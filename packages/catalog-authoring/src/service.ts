import { priceCatalogs } from "@voyantjs/pricing/schema"
import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type BuildProductGraphResult, buildProductGraph } from "./builder.js"
import { type AuthoringIssue, AuthoringValidationError } from "./errors.js"
import { productAuthoringRequests } from "./schema.js"
import { serializeProductGraph } from "./serialize.js"
import type { ProductGraphSpec } from "./spec.js"
import { validateProductGraph } from "./validate.js"

export interface CloneProductOverrides {
  name: string
  status?: ProductGraphSpec["product"]["status"]
  visibility?: ProductGraphSpec["product"]["visibility"]
}

export interface AuthoringRunOptions {
  userId?: string
  /** Dedup key; a retried request with the same key returns the first result. */
  idempotencyKey?: string
}

export type CloneProductOutcome =
  | { status: "ok"; result: BuildProductGraphResult; reused: boolean }
  | { status: "not_found" }

export type ComposeProductOutcome =
  | { status: "ok"; result: BuildProductGraphResult; reused: boolean }
  | { status: "invalid"; issues: AuthoringIssue[] }

/** Resolves the operator's default price catalog id, if one exists. */
async function getDefaultCatalogId(db: PostgresJsDatabase): Promise<string | undefined> {
  const [row] = await db
    .select({ id: priceCatalogs.id })
    .from(priceCatalogs)
    .where(and(eq(priceCatalogs.isDefault, true), eq(priceCatalogs.active, true)))
    .limit(1)
  return row?.id
}

/**
 * Resolves an idempotency key inside an open transaction. Returns the previously
 * created product id when the key has been seen, else runs `build`, records the
 * key, and returns the fresh result. The advisory lock serializes concurrent
 * requests sharing a key (the booking-create guard pattern).
 */
async function withIdempotency(
  tx: PostgresJsDatabase,
  key: string | undefined,
  operation: string,
  build: () => Promise<BuildProductGraphResult>,
): Promise<{ result: BuildProductGraphResult; reused: boolean }> {
  if (!key) {
    return { result: await build(), reused: false }
  }

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)

  const [existing] = await tx
    .select({ productId: productAuthoringRequests.productId })
    .from(productAuthoringRequests)
    .where(eq(productAuthoringRequests.idempotencyKey, key))
    .limit(1)

  if (existing) {
    return { result: { productId: existing.productId, options: [] }, reused: true }
  }

  const result = await build()
  await tx
    .insert(productAuthoringRequests)
    .values({ idempotencyKey: key, productId: result.productId, operation })

  return { result, reused: false }
}

/**
 * Deep-clone a product graph (#1493). Serializes the source, patches the product
 * row, and rebuilds atomically. Cloned price rules keep the source catalog. Does
 * NOT copy availability slots.
 */
export async function cloneProduct(
  db: PostgresJsDatabase,
  sourceProductId: string,
  overrides: CloneProductOverrides,
  options: AuthoringRunOptions = {},
): Promise<CloneProductOutcome> {
  const source = await serializeProductGraph(db, sourceProductId)
  if (!source) return { status: "not_found" }

  const spec: ProductGraphSpec = {
    ...source,
    product: {
      ...source.product,
      name: overrides.name,
      status: overrides.status ?? "draft",
      visibility: overrides.visibility ?? source.product.visibility,
    },
  }

  const { result, reused } = await db.transaction((tx) =>
    withIdempotency(tx, options.idempotencyKey, "duplicate", () =>
      buildProductGraph(tx, spec, { userId: options.userId }),
    ),
  )

  return { status: "ok", result, reused }
}

/**
 * Compose a brand-new product graph from a caller-supplied spec (#1495). Runs the
 * category validator first; an invalid spec is returned (never built) so the
 * caller can self-correct. Rules without a catalog fall back to the operator
 * default.
 */
export async function composeProduct(
  db: PostgresJsDatabase,
  spec: ProductGraphSpec,
  options: AuthoringRunOptions = {},
): Promise<ComposeProductOutcome> {
  const issues = validateProductGraph(spec)
  if (issues.length) return { status: "invalid", issues }

  const defaultCatalogId = await getDefaultCatalogId(db)

  try {
    const { result, reused } = await db.transaction((tx) =>
      withIdempotency(tx, options.idempotencyKey, "compose", () =>
        buildProductGraph(tx, spec, { userId: options.userId, defaultCatalogId }),
      ),
    )
    return { status: "ok", result, reused }
  } catch (error) {
    if (error instanceof AuthoringValidationError) {
      return { status: "invalid", issues: error.issues }
    }
    throw error
  }
}
