/**
 * Products content shape — the rich detail-page content shape returned
 * by `getContent` and stored in `products_sourced_content.payload`.
 *
 * Schema versions are managed by this module: the constant
 * `PRODUCTS_CONTENT_SCHEMA_VERSION` stamps every cache write; reads
 * skip rows with an unrecognized version (treated as cache miss). Bump
 * the version when the shape changes; old cache rows are then evicted
 * by a single `DELETE WHERE content_schema_version != current`.
 *
 * This module is the pure content contract: schemas, types, version, and
 * the validator. The `mergeOverlaysIntoProductContent` overlay
 * composition stays in the `@voyant-travel/inventory` runtime package.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2, §3.5.4, §3.6.
 */

import { boardBasisSchema } from "@voyant-travel/catalog-contracts/content"
import { z } from "zod"

/**
 * The current content-schema version. Stamped on every cache write.
 * Bump when the `productContentSchema` shape changes incompatibly.
 */
export const PRODUCTS_CONTENT_SCHEMA_VERSION = "products/v1"

/**
 * Top-level product summary fields. Maps loosely to the owned `products`
 * table — the read service synthesizes from indexed projection + overlay
 * for thin adapters, or stores adapter-served data for rich ones.
 */
export const productSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  open_graph_image_url: z.string().nullable().optional(),
  open_graph_image_width: z.number().int().positive().nullable().optional(),
  open_graph_image_height: z.number().int().positive().nullable().optional(),
  open_graph_image_type: z.string().nullable().optional(),
  open_graph_image_alt: z.string().nullable().optional(),
  inclusions_html: z.string().nullable().optional(),
  exclusions_html: z.string().nullable().optional(),
  terms_html: z.string().nullable().optional(),
  contract_template_id: z.string().nullable().optional(),
  contractTemplateId: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  hero_image_url: z.string().nullable().optional(),
  duration_days: z.number().int().nonnegative().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  sell_currency: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  departure_city: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

export const productMediaItemSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "video", "document"]).default("image"),
  caption: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
})

export const productOptionUnitSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().nonnegative().nullable().optional(),
})

export const productOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  // `boardBasisSchema` comes from @voyant-travel/catalog-contracts. Defer the
  // dereference with `z.lazy` so a bundler that splits it into a circular chunk
  // cannot observe it `undefined` during this module's evaluation — accessing it
  // eagerly here threw `Cannot read properties of undefined (reading 'nullable')`
  // and 500'd every catalog read in app worker bundles.
  board_basis: z
    .lazy(() => boardBasisSchema)
    .nullable()
    .optional(),
  units: z.array(productOptionUnitSchema).optional().default([]),
  inclusions: z.array(z.string()).optional().default([]),
})

export const productDaySchema = z.object({
  day_number: z.number().int().positive(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  /** Day-level hero image (catalog detail sheet thumbnail). */
  hero_image_url: z.string().nullable().optional(),
  services: z.array(z.string()).optional().default([]),
})

export const productPolicySchema = z.object({
  kind: z.enum(["cancellation", "payment", "supplier_notes", "requirements"]),
  body: z.string(),
  /** Optional structured rules — vertical-specific. */
  rules: z.unknown().optional(),
})

/**
 * A single bookable departure / time slot — the "when" surface of the
 * product. ISO 8601 timestamps for `starts_at` / `ends_at` so locale
 * formatting happens at render time, never in the cache.
 *
 * Owned products derive these from `availability_slots`; sourced
 * adapters return them via `getContent`. Empty array = "always-on"
 * product (e.g. an evergreen transfer service) or one whose schedule
 * is on-request.
 */
export const productDepartureSchema = z.object({
  id: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable().optional(),
  /** "open" | "limited" | "sold_out" | "closed" | "on_request" — display only. */
  status: z.string().nullable().optional(),
  /** Total capacity for the slot, when known. */
  capacity: z.number().int().nonnegative().nullable().optional(),
  /** Remaining capacity. Null = unknown / not surfaced; 0 = sold out. */
  remaining: z.number().int().nonnegative().nullable().optional(),
  /** Lowest pricing hint in cents — display only. Real price comes via liveResolve. */
  lowest_price_cents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().nullable().optional(),
  /** Free-form note (weather caveat, sales window, etc). */
  note: z.string().nullable().optional(),
})

/**
 * The product content payload. Cache writes validate against this
 * schema; cache reads skip rows that don't validate (treated as cache
 * miss to surface adapter integration bugs without corrupting reads).
 */
export const productContentSchema = z.object({
  product: productSummarySchema,
  options: z.array(productOptionSchema).default([]),
  days: z.array(productDaySchema).default([]),
  media: z.array(productMediaItemSchema).default([]),
  policies: z.array(productPolicySchema).default([]),
  departures: z.array(productDepartureSchema).default([]),
})

export type ProductContent = z.infer<typeof productContentSchema>
export type ProductSummary = z.infer<typeof productSummarySchema>
export type ProductMediaItem = z.infer<typeof productMediaItemSchema>
export type ProductOption = z.infer<typeof productOptionSchema>
export type ProductDeparture = z.infer<typeof productDepartureSchema>
export type ProductDay = z.infer<typeof productDaySchema>
export type ProductPolicy = z.infer<typeof productPolicySchema>

export {
  BOARD_BASIS_FROM_SHORT_CODE,
  BOARD_BASIS_SHORT_CODES,
  BOARD_BASIS_VALUES,
  type BoardBasis,
  type BoardBasisShortCode,
  boardBasisSchema,
} from "@voyant-travel/catalog-contracts/content"

/**
 * Validate a `ProductContent` payload. Returns the parsed result on
 * success or a structured failure on rejection. Used by the cache write
 * path and by `mergeOverlaysIntoProductContent` to gate overlay merges.
 */
export function validateProductContent(
  payload: unknown,
): { valid: true; content: ProductContent } | { valid: false; reason: string } {
  const result = productContentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, content: result.data }
  }
  // Take the first issue's message — that's enough signal for ops; full
  // detail is available on `result.error.issues` if a caller cares.
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}
