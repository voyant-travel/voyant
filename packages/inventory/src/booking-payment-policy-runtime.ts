import { bookingItems } from "@voyant-travel/bookings/schema"
import {
  createPaymentPolicyCascade,
  type PaymentPolicy,
  type PaymentPolicyEntityContext,
} from "@voyant-travel/finance"
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { productCategories, productCategoryProducts, products } from "./schema.js"

type PolicyReader = (db: PostgresJsDatabase, bookingId: string) => Promise<PaymentPolicy | null>
type EntityPolicyReader = (
  db: PostgresJsDatabase,
  context: PaymentPolicyEntityContext,
) => Promise<PaymentPolicy | null>

export interface InventoryPaymentPolicyRuntimeOptions {
  resolveSupplierPolicy: PolicyReader
  resolveSupplierPolicyById(
    db: PostgresJsDatabase,
    supplierId: string,
  ): Promise<PaymentPolicy | null>
  resolveVerticalListingPolicy: PolicyReader
  resolveVerticalListingPolicyForEntity: EntityPolicyReader
  resolveVerticalSupplierPolicyForEntity: EntityPolicyReader
}

/** Compose standard product/category policy readers with installed vertical readers. */
export function createInventoryPaymentPolicyRuntime(options: InventoryPaymentPolicyRuntimeOptions) {
  const resolveCategoryPolicy: PolicyReader = async (db, bookingId) => {
    const productIds = await db
      .select({ productId: bookingItems.productId })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId))
    const ids = productIds.map((row) => row.productId).filter((id): id is string => Boolean(id))
    if (ids.length === 0) return null

    const [row] = await db
      .select({ policy: productCategories.customerPaymentPolicy })
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

  const resolveProductListingPolicy: PolicyReader = async (db, bookingId) => {
    const [row] = await db
      .select({ policy: products.customerPaymentPolicy })
      .from(bookingItems)
      .innerJoin(products, eq(products.id, bookingItems.productId))
      .where(and(eq(bookingItems.bookingId, bookingId), isNotNull(products.customerPaymentPolicy)))
      .orderBy(asc(bookingItems.createdAt))
      .limit(1)
    return (row?.policy as PaymentPolicy | null | undefined) ?? null
  }

  const resolveListingPolicy: PolicyReader = async (db, bookingId) =>
    (await options.resolveVerticalListingPolicy(db, bookingId)) ??
    resolveProductListingPolicy(db, bookingId)

  const resolveCategoryPolicyForEntity: EntityPolicyReader = async (db, context) => {
    if (context.entityModule !== "products") return null
    const [row] = await db
      .select({ policy: productCategories.customerPaymentPolicy })
      .from(productCategoryProducts)
      .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
      .where(
        and(
          eq(productCategoryProducts.productId, context.entityId),
          isNotNull(productCategories.customerPaymentPolicy),
        ),
      )
      .orderBy(asc(productCategoryProducts.sortOrder), asc(productCategoryProducts.createdAt))
      .limit(1)
    return (row?.policy as PaymentPolicy | null | undefined) ?? null
  }

  const resolveListingPolicyForEntity: EntityPolicyReader = async (db, context) => {
    if (context.entityModule !== "products") {
      return options.resolveVerticalListingPolicyForEntity(db, context)
    }
    const [row] = await db
      .select({ policy: products.customerPaymentPolicy })
      .from(products)
      .where(eq(products.id, context.entityId))
      .limit(1)
    return (row?.policy as PaymentPolicy | null | undefined) ?? null
  }

  const resolveSupplierPolicyForEntity: EntityPolicyReader = async (db, context) => {
    if (context.entityModule !== "products") {
      return options.resolveVerticalSupplierPolicyForEntity(db, context)
    }
    const [row] = await db
      .select({ supplierId: products.supplierId })
      .from(products)
      .where(eq(products.id, context.entityId))
      .limit(1)
    return row?.supplierId ? options.resolveSupplierPolicyById(db, row.supplierId) : null
  }

  const readers = {
    resolveSupplierPolicy: options.resolveSupplierPolicy,
    resolveCategoryPolicy,
    resolveListingPolicy,
    resolveSupplierPolicyForEntity,
    resolveCategoryPolicyForEntity,
    resolveListingPolicyForEntity,
  }
  return { ...readers, bookingPaymentPolicyCascade: createPaymentPolicyCascade({ readers }) }
}

export {
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "@voyant-travel/finance"
export type { PaymentPolicyEntityContext }
