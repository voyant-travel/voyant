/**
 * Products admin operations — read surface (list, get).
 *
 * Write operations (create/update/delete) are intentionally deferred: products
 * validation still lives in the runtime `@voyantjs/products` package (which
 * carries drizzle/db deps), not in a pure `*-contracts` package. Deriving write
 * inputs here would pollute this zero-runtime contract package. Once products'
 * validation is extracted to `@voyantjs/products-contracts` (mirroring the
 * bookings/finance/crm/legal split), the write descriptors derive from it. The
 * read surface needs no input schema, so it ships now.
 */

import { z } from "zod"

import { defineOperation } from "./core/operation.js"
import { pageQuerySchema, paginated } from "./core/pagination.js"

export const productSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type ProductSummary = z.infer<typeof productSummarySchema>

export const productsListInputSchema = pageQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  productType: z.string().optional(),
})

const list = defineOperation({
  id: "products.list",
  method: "GET",
  path: () => "/v1/admin/products",
  pathTemplate: "/v1/admin/products",
  input: productsListInputSchema,
  output: paginated(productSummarySchema),
  classification: "read",
  scopes: ["products:read"],
  envelope: "raw",
  summary: "List products with filters and offset pagination.",
})

const get = defineOperation({
  id: "products.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/products/${p.id}`,
  pathTemplate: "/v1/admin/products/:id",
  input: z.object({}),
  output: productSummarySchema,
  classification: "read",
  scopes: ["products:read"],
  summary: "Get a single product by id.",
})

export const productsOperations = { list, get } as const
