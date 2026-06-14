import { ratePlans, stayBookingItems } from "@voyantjs/accommodations/schema"
import { bookingItems, bookingSupplierStatuses, bookings } from "@voyantjs/bookings/schema"
import { bookingCruiseDetails } from "@voyantjs/cruises/booking-extension"
import { cruiseCabinCategories, cruiseSailings, cruises } from "@voyantjs/cruises/schema"
import { supplierServices, suppliers } from "@voyantjs/distribution"
import type { PaymentPolicy, PaymentPolicySource } from "@voyantjs/finance"
import { productCategories, productCategoryProducts, products } from "@voyantjs/inventory/schema"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface PaymentPolicyEntityContext {
  entityModule: string
  entityId: string
  sailingId?: string
  cabinCategoryId?: string
  ratePlanId?: string
}

/**
 * Resolve the supplier (if any) of a booking. Picks the first
 * `booking_supplier_statuses` row by creation order and walks
 * `supplier_services.supplier_id` -> `suppliers.customer_payment_policy`.
 *
 * Returns `null` when:
 *   - the booking has no supplier-status rows (most owned bookings)
 *   - the supplier service can't be resolved
 *   - the supplier has no customer-policy override (`null` jsonb)
 *
 * Multi-supplier bookings (rare) only get the first supplier's
 * policy. A future iteration could resolve per-line policies if the
 * use case shows up.
 */
export async function resolveSupplierPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({
      policy: suppliers.customerPaymentPolicy,
    })
    .from(bookingSupplierStatuses)
    .innerJoin(supplierServices, eq(supplierServices.id, bookingSupplierStatuses.supplierServiceId))
    .innerJoin(suppliers, eq(suppliers.id, supplierServices.supplierId))
    .where(eq(bookingSupplierStatuses.bookingId, bookingId))
    .orderBy(asc(bookingSupplierStatuses.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Resolve the product-category policy (if any) for a booking.
 *
 * Walks `booking_items.product_id` -> `product_category_products` ->
 * `product_categories` and picks the FIRST category by
 * `productCategoryProducts.sortOrder` ascending that has a non-null
 * `customer_payment_policy`. Multi-product bookings consider every
 * product's categories merged into a single sort order.
 *
 * Returns `null` when:
 *   - the booking has no product items linked to categories
 *   - none of the matched categories have a policy override
 */
export async function resolveCategoryPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const productIds = await db
    .select({ productId: bookingItems.productId })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))

  const ids = productIds.map((r) => r.productId).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return null

  const [row] = await db
    .select({
      policy: productCategories.customerPaymentPolicy,
    })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        inArray(productCategoryProducts.productId, ids),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Resolve the per-listing policy (if any) for a booking. Tries each
 * vertical's listing-shape in order:
 *
 *   1. Cruise — cabin category > sailing > cruise (most-specific
 *      first, since cabin-category overrides are common in cruise
 *      pricing).
 *   2. Accommodation — the booking's selected rate-plan policy.
 *   3. Product — the booking's first non-null product policy.
 *
 * Returns the first non-null policy found across the verticals.
 * `null` falls through to the category / supplier / operator
 * default in the cascade.
 */
export async function resolveListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const cruisePolicy = await resolveCruiseListingPolicy(db, bookingId)
  if (cruisePolicy) return cruisePolicy

  const stayPolicy = await resolveAccommodationListingPolicy(db, bookingId)
  if (stayPolicy) return stayPolicy

  return resolveProductListingPolicy(db, bookingId)
}

/**
 * Accommodation-vertical listing resolver.
 *
 * Walks `stay_booking_items.rate_plan_id` -> `rate_plans` and returns
 * the first non-null `customerPaymentPolicy`. Accommodation bookings
 * link from the generic `booking_items` row through
 * `stay_booking_items` to a `rate_plans` row — non-refundable
 * advance-purchase rates carry stricter terms than flexible best-
 * available rates at the same property.
 *
 * Returns `null` when this isn't an accommodations booking (no
 * stay_booking_items row) or none of the matched rate plans carry a
 * policy override.
 *
 * Multi-room bookings (rare for direct customer bookings, common
 * for groups) take the first stay_booking_items row by
 * createdAt — same heuristic as products.
 */
async function resolveAccommodationListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({ policy: ratePlans.customerPaymentPolicy })
    .from(stayBookingItems)
    .innerJoin(bookingItems, eq(bookingItems.id, stayBookingItems.bookingItemId))
    .innerJoin(ratePlans, eq(ratePlans.id, stayBookingItems.ratePlanId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(ratePlans.customerPaymentPolicy)))
    .orderBy(asc(stayBookingItems.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Cruise-vertical listing resolver.
 *
 * Reads `booking_cruise_details.{sailingId, cabinCategoryId}` and
 * walks the three cruise layers in most-specific order:
 *
 *   cabin_category.customerPaymentPolicy
 *     falls back to
 *   cruise_sailings.customerPaymentPolicy
 *     falls back to
 *   cruises.customerPaymentPolicy
 *
 * Returns `null` when this isn't a cruise booking (no
 * booking_cruise_details row) or when none of the three cruise
 * layers carry a policy — letting the caller fall through to the
 * product / category / supplier / operator-default cascade.
 */
async function resolveCruiseListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [details] = await db
    .select({
      sailingId: bookingCruiseDetails.sailingId,
      cabinCategoryId: bookingCruiseDetails.cabinCategoryId,
    })
    .from(bookingCruiseDetails)
    .where(eq(bookingCruiseDetails.bookingId, bookingId))
    .limit(1)
  if (!details) return null

  if (details.cabinCategoryId) {
    const [cabin] = await db
      .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.id, details.cabinCategoryId))
      .limit(1)
    const cabinPolicy = (cabin?.policy as PaymentPolicy | null | undefined) ?? null
    if (cabinPolicy) return cabinPolicy
  }

  if (details.sailingId) {
    const [sailing] = await db
      .select({
        policy: cruiseSailings.customerPaymentPolicy,
        cruiseId: cruiseSailings.cruiseId,
      })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.id, details.sailingId))
      .limit(1)
    const sailingPolicy = (sailing?.policy as PaymentPolicy | null | undefined) ?? null
    if (sailingPolicy) return sailingPolicy

    if (sailing?.cruiseId) {
      const [cruise] = await db
        .select({ policy: cruises.customerPaymentPolicy })
        .from(cruises)
        .where(eq(cruises.id, sailing.cruiseId))
        .limit(1)
      return (cruise?.policy as PaymentPolicy | null | undefined) ?? null
    }
  }

  return null
}

/**
 * Products-vertical listing resolver.
 *
 * Multi-product bookings: takes the first product (ordered by
 * `booking_items.createdAt` ascending) with a non-null policy.
 * Mixed-product bookings (e.g. tour + add-on transfer) typically
 * have one "primary" product driving the booking total, so first-by-
 * creation is a sensible default. Operators with mixed-vertical
 * bookings can promote the per-booking override when this default
 * doesn't fit.
 */
async function resolveProductListingPolicy(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentPolicy | null> {
  const [row] = await db
    .select({
      policy: products.customerPaymentPolicy,
    })
    .from(bookingItems)
    .innerJoin(products, eq(products.id, bookingItems.productId))
    .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(products.customerPaymentPolicy)))
    .orderBy(asc(bookingItems.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

const POLICY_SOURCE_MARKER_PREFIX = "__payment_policy_source__:"

export async function stampPolicySourceOnBooking(
  db: PostgresJsDatabase,
  bookingId: string,
  source: PaymentPolicySource,
): Promise<void> {
  const [row] = await db
    .select({ internalNotes: bookings.internalNotes })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) return

  const filtered = (row.internalNotes ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(POLICY_SOURCE_MARKER_PREFIX))
    .join("\n")

  const marker = `${POLICY_SOURCE_MARKER_PREFIX}${source}`
  const next = filtered.length > 0 ? `${filtered}\n${marker}` : marker

  await db
    .update(bookings)
    .set({ internalNotes: next, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
}

/**
 * Read the policy-source marker stamped onto a booking by the
 * schedule subscriber. Used by the contract resolver so
 * `booking.paymentPolicy.source` reflects the actual cascade layer
 * (`supplier`, `operator_default`, etc.) rather than always echoing
 * `"operator_default"`.
 */
export function readPolicySourceFromInternalNotes(
  internalNotes: string | null | undefined,
): PaymentPolicySource | null {
  if (!internalNotes) return null
  for (const line of internalNotes.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(POLICY_SOURCE_MARKER_PREFIX)) {
      const value = trimmed.slice(POLICY_SOURCE_MARKER_PREFIX.length).trim()
      switch (value) {
        case "booking":
        case "listing":
        case "category":
        case "supplier":
        case "operator_default":
          return value
        default:
          return null
      }
    }
  }
  return null
}

/**
 * Per-entity listing resolver — used at storefront-preview time
 * before a booking exists. Mirrors `resolveListingPolicy` but keyed
 * off journey-level selections.
 */
export async function resolveListingPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule === "cruises") {
    if (ctx.cabinCategoryId) {
      const [cabin] = await db
        .select({ policy: cruiseCabinCategories.customerPaymentPolicy })
        .from(cruiseCabinCategories)
        .where(eq(cruiseCabinCategories.id, ctx.cabinCategoryId))
        .limit(1)
      const cabinPolicy = (cabin?.policy as PaymentPolicy | null | undefined) ?? null
      if (cabinPolicy) return cabinPolicy
    }
    if (ctx.sailingId) {
      const [sailing] = await db
        .select({ policy: cruiseSailings.customerPaymentPolicy })
        .from(cruiseSailings)
        .where(eq(cruiseSailings.id, ctx.sailingId))
        .limit(1)
      const sailingPolicy = (sailing?.policy as PaymentPolicy | null | undefined) ?? null
      if (sailingPolicy) return sailingPolicy
    }
    const [cruise] = await db
      .select({ policy: cruises.customerPaymentPolicy })
      .from(cruises)
      .where(eq(cruises.id, ctx.entityId))
      .limit(1)
    return (cruise?.policy as PaymentPolicy | null | undefined) ?? null
  }

  if (ctx.entityModule === "accommodations") {
    if (ctx.ratePlanId) {
      const [plan] = await db
        .select({ policy: ratePlans.customerPaymentPolicy })
        .from(ratePlans)
        .where(eq(ratePlans.id, ctx.ratePlanId))
        .limit(1)
      return (plan?.policy as PaymentPolicy | null | undefined) ?? null
    }
    return null
  }

  if (ctx.entityModule === "products") {
    const [product] = await db
      .select({ policy: products.customerPaymentPolicy })
      .from(products)
      .where(eq(products.id, ctx.entityId))
      .limit(1)
    return (product?.policy as PaymentPolicy | null | undefined) ?? null
  }

  return null
}

/**
 * Per-entity category resolver. Currently only products carry
 * categories — cruises and accommodations fall through.
 */
export async function resolveCategoryPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  if (ctx.entityModule !== "products") return null

  const [row] = await db
    .select({ policy: productCategories.customerPaymentPolicy })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(
        eq(productCategoryProducts.productId, ctx.entityId),
        isNotNull(productCategories.customerPaymentPolicy),
      ),
    )
    .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
    .limit(1)

  return (row?.policy as PaymentPolicy | null | undefined) ?? null
}

/**
 * Per-entity supplier resolver. Reads the supplier id off the entity
 * row directly (products.supplierId, cruises.lineSupplierId, etc.)
 * and looks up the supplier's policy. Owned products may have a null
 * supplier — falls through.
 */
export async function resolveSupplierPolicyForEntity(
  db: PostgresJsDatabase,
  ctx: PaymentPolicyEntityContext,
): Promise<PaymentPolicy | null> {
  let supplierId: string | null = null

  if (ctx.entityModule === "products") {
    const [row] = await db
      .select({ supplierId: products.supplierId })
      .from(products)
      .where(eq(products.id, ctx.entityId))
      .limit(1)
    supplierId = row?.supplierId ?? null
  } else if (ctx.entityModule === "cruises") {
    const [row] = await db
      .select({ supplierId: cruises.lineSupplierId })
      .from(cruises)
      .where(eq(cruises.id, ctx.entityId))
      .limit(1)
    supplierId = row?.supplierId ?? null
  }

  if (!supplierId) return null

  const [supplier] = await db
    .select({ policy: suppliers.customerPaymentPolicy })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1)

  return (supplier?.policy as PaymentPolicy | null | undefined) ?? null
}
