import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { products } from "./schema-core.js"

export const productTypes = pgTable(
  "product_types",
  {
    id: typeId("product_types"),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_product_types_code").on(table.code),
    index("idx_product_types_active").on(table.active),
    index("idx_product_types_sort_name").on(table.sortOrder, table.name),
    index("idx_product_types_active_sort_name").on(table.active, table.sortOrder, table.name),
  ],
)

export type ProductType = typeof productTypes.$inferSelect
export type NewProductType = typeof productTypes.$inferInsert

export const productCategories = pgTable(
  "product_categories",
  {
    id: typeId("product_categories"),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /**
     * Customer-facing payment policy override. When set, bookings
     * for products in this category inherit these terms (unless
     * the listing or booking sets its own override). Shape mirrors
     * `PaymentPolicy` from `@voyantjs/finance`.
     *
     * `null` means "inherit from supplier / operator default".
     *
     * Multi-category products: the cascade picks the FIRST category
     * (ordered by `productCategoryProducts.sortOrder` ascending) that
     * has a non-null policy.
     */
    customerPaymentPolicy: jsonb("customer_payment_policy"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_product_categories_slug").on(table.slug),
    index("idx_product_categories_parent").on(table.parentId),
    index("idx_product_categories_active").on(table.active),
    index("idx_product_categories_sort_name").on(table.sortOrder, table.name),
    index("idx_product_categories_active_sort_name").on(table.active, table.sortOrder, table.name),
    index("idx_product_categories_parent_sort_name").on(
      table.parentId,
      table.sortOrder,
      table.name,
    ),
  ],
)

export type ProductCategory = typeof productCategories.$inferSelect
export type NewProductCategory = typeof productCategories.$inferInsert

export const productTags = pgTable(
  "product_tags",
  {
    id: typeId("product_tags"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uidx_product_tags_name").on(table.name)],
)

export type ProductTag = typeof productTags.$inferSelect
export type NewProductTag = typeof productTags.$inferInsert

export const destinations = pgTable(
  "destinations",
  {
    id: typeId("destinations"),
    parentId: typeIdRef("parent_id"),
    slug: text("slug").notNull(),
    code: text("code"),
    destinationType: text("destination_type").notNull().default("destination"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_destinations_slug").on(table.slug),
    uniqueIndex("uidx_destinations_code").on(table.code),
    index("idx_destinations_parent").on(table.parentId),
    index("idx_destinations_active").on(table.active),
    index("idx_destinations_sort_slug").on(table.sortOrder, table.slug),
    index("idx_destinations_active_sort_slug").on(table.active, table.sortOrder, table.slug),
    index("idx_destinations_type_sort_slug").on(table.destinationType, table.sortOrder, table.slug),
    index("idx_destinations_parent_sort_slug").on(table.parentId, table.sortOrder, table.slug),
  ],
)

export type Destination = typeof destinations.$inferSelect
export type NewDestination = typeof destinations.$inferInsert

export const destinationTranslations = pgTable(
  "destination_translations",
  {
    id: typeId("destination_translations"),
    destinationId: typeIdRef("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    languageTag: text("language_tag").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_destination_translations_locale").on(table.destinationId, table.languageTag),
    index("idx_destination_translations_language").on(table.languageTag),
    index("idx_destination_translations_destination_language_created").on(
      table.destinationId,
      table.languageTag,
      table.createdAt,
    ),
    index("idx_destination_translations_language_created").on(table.languageTag, table.createdAt),
  ],
)

export type DestinationTranslation = typeof destinationTranslations.$inferSelect
export type NewDestinationTranslation = typeof destinationTranslations.$inferInsert

export const productCategoryProducts = pgTable(
  "product_category_products",
  {
    productId: typeIdRef("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: typeIdRef("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("idx_pcp_product_sort").on(table.productId, table.sortOrder),
    index("idx_pcp_category").on(table.categoryId),
  ],
)

export const productTagProducts = pgTable(
  "product_tag_products",
  {
    productId: typeIdRef("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: typeIdRef("tag_id")
      .notNull()
      .references(() => productTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.tagId] }),
    index("idx_ptp_tag").on(table.tagId),
  ],
)

export const productDestinations = pgTable(
  "product_destinations",
  {
    productId: typeIdRef("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    destinationId: typeIdRef("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.destinationId] }),
    index("idx_product_destinations_product_sort").on(table.productId, table.sortOrder),
    index("idx_product_destinations_destination_sort").on(table.destinationId, table.sortOrder),
  ],
)
