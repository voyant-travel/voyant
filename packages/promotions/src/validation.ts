/**
 * Validation schemas for the promotions module.
 *
 * Per docs/architecture/promotions-architecture.md §3.2 (scope), §4.1 (offer
 * fields), §11 (currency rules), §12.1 (conditions schema).
 *
 * The scope discriminated union is the source of truth for what an offer
 * applies to; the materialized `promotional_offer_products` link table (§4.2)
 * is rebuilt from it on every create / update.
 */

import { z } from "zod"

// ---------- Scope discriminated union (§3.2) ----------
//
// Audience literal inlined to avoid a back-edge from @voyantjs/promotions to
// @voyantjs/catalog (where Visibility lives). A unit test pins the literal
// set against catalog's Visibility export.

const audienceLiteral = z.enum(["staff", "customer", "partner", "supplier"])

export const promotionalOfferScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("global") }),
  z.object({
    kind: z.literal("products"),
    productIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("categories"),
    categoryIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("destinations"),
    destinationIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("markets"),
    marketIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("audiences"),
    audiences: z.array(audienceLiteral).min(1),
  }),
  z.object({
    kind: z.literal("fare_codes"),
    fareCodes: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("cabin_grades"),
    cabinGradeCodes: z.array(z.string().min(1)).min(1),
  }),
])

export type PromotionalOfferScope = z.infer<typeof promotionalOfferScopeSchema>
export type PromotionalOfferScopeKind = PromotionalOfferScope["kind"]

// ---------- Conditions (§12.1) ----------
//
// Typed JSONB validated by Zod. Date validity stays on the offer header
// (`validFrom` / `validUntil`) — not duplicated in `conditions` for v1.

export const promotionalOfferConditionsSchema = z.object({
  /** Minimum total travelers. Catalog-plane evaluation surfaces this as a
   *  conditional offer when pax is unknown; checkout treats below-minimum
   *  as a hard exclusion. */
  minPax: z.number().int().positive().optional(),
  /** Requires a known past guest / loyalty customer signal. */
  pastGuestOnly: z.boolean().optional(),
  /** Requires a single-traveler party. Falls back to `pax === 1` when pax is known. */
  soloTravelerOnly: z.boolean().optional(),
  /** Requires at least one child traveler in the party. */
  childTravelerOnly: z.boolean().optional(),
  /** Requires the booking party to qualify as a family. */
  familyOnly: z.boolean().optional(),
})

export type PromotionalOfferConditions = z.infer<typeof promotionalOfferConditionsSchema>

// ---------- Discount type / value cross-field rule (§11) ----------
//
// `percentage` requires `discountPercent`; `fixed_amount` requires
// `discountAmountCents` + `currency`. The other-flavor fields must be
// null/undefined to prevent operator confusion.

const discountTypeEnum = z.enum(["percentage", "fixed_amount"])

const baseOfferShape = {
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  description: z.string().nullable().optional(),
  discountType: discountTypeEnum,
  discountPercent: z.number().positive().max(100).nullable().optional(),
  discountAmountCents: z.number().int().positive().nullable().optional(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO 4217 code")
    .nullable()
    .optional(),
  scope: promotionalOfferScopeSchema,
  conditions: promotionalOfferConditionsSchema.optional().default({}),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  /** Stored lowercase. Provided in any case at the API; lowercased before insert. */
  code: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be alphanumeric (with - or _)")
    .nullable()
    .optional(),
  stackable: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}

function applyDiscountTypeRules<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema
    .refine(
      (value) => {
        if (value.discountType !== "percentage") return true
        return (
          value.discountPercent != null &&
          value.discountAmountCents == null &&
          value.currency == null
        )
      },
      {
        message:
          "percentage offers require `discountPercent` and must not set `discountAmountCents` or `currency`",
        path: ["discountType"],
      },
    )
    .refine(
      (value) => {
        if (value.discountType !== "fixed_amount") return true
        return (
          value.discountAmountCents != null &&
          value.currency != null &&
          value.discountPercent == null
        )
      },
      {
        message:
          "fixed_amount offers require `discountAmountCents` and `currency` and must not set `discountPercent`",
        path: ["discountType"],
      },
    )
    .refine(
      (value) => {
        if (value.validFrom == null || value.validUntil == null) return true
        return value.validFrom < value.validUntil
      },
      { message: "`validFrom` must be earlier than `validUntil`", path: ["validFrom"] },
    )
}

export const insertPromotionalOfferSchema = applyDiscountTypeRules(z.object(baseOfferShape))

export const updatePromotionalOfferSchema = applyDiscountTypeRules(
  z.object({
    ...baseOfferShape,
    discountType: discountTypeEnum.optional(),
    scope: promotionalOfferScopeSchema.optional(),
    name: baseOfferShape.name.optional(),
    slug: baseOfferShape.slug.optional(),
  }),
)

export const promotionalOfferListQuerySchema = z.object({
  active: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  code: z.string().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  applicationMode: z.enum(["auto", "code"]).optional(),
  status: z.enum(["active", "scheduled", "expired", "archived"]).optional(),
  scopeKind: z
    .enum([
      "global",
      "products",
      "categories",
      "destinations",
      "markets",
      "audiences",
      "fare_codes",
      "cabin_grades",
    ])
    .optional(),
  validFrom: z.string().date().optional(),
  validUntil: z.string().date().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
})

export type InsertPromotionalOfferInput = z.input<typeof insertPromotionalOfferSchema>
export type InsertPromotionalOffer = z.infer<typeof insertPromotionalOfferSchema>
export type UpdatePromotionalOfferInput = z.input<typeof updatePromotionalOfferSchema>
export type UpdatePromotionalOffer = z.infer<typeof updatePromotionalOfferSchema>
export type PromotionalOfferListQuery = z.infer<typeof promotionalOfferListQuerySchema>
export type PromotionalOfferApplicationMode = NonNullable<
  PromotionalOfferListQuery["applicationMode"]
>
export type PromotionalOfferListStatus = NonNullable<PromotionalOfferListQuery["status"]>
