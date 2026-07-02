/**
 * Inventory (products) agent tools on the framework tool contract.
 *
 * Thin, read-only wrappers over the existing products service — no new domain
 * logic. The service is injected on the context by intersection
 * (`InventoryToolContext`), so this module stays deployment-agnostic; the
 * operator binds the service to its request `db` and registers these tools on the
 * shared MCP registry alongside every other domain's tools.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { productListQuerySchema } from "./validation.js"

/** A paginated product list result (the shape the products service returns). */
export interface ProductListResult {
  data: unknown[]
  total: number
  limit: number
  offset: number
}

/** The products read surface a deployment binds into the tool context. */
export interface InventoryToolServices {
  listProducts(query: z.infer<typeof productListQuerySchema>): Promise<ProductListResult>
  getProductById(id: string): Promise<unknown | null>
}

/** Tool context with the inventory service injected. */
export type InventoryToolContext = ToolContext & { inventory?: InventoryToolServices }

function inventory(ctx: InventoryToolContext): InventoryToolServices {
  return requireService(ctx.inventory, "inventory")
}

export const listProductsTool = defineTool<
  z.infer<typeof productListQuerySchema>,
  ProductListResult,
  InventoryToolContext
>({
  name: "list_products",
  description:
    "List products with optional filters (status, booking mode, category, tag, search, " +
    "date range, price/pax bounds) and pagination. Returns { data, total, limit, offset }. " +
    "Read-only.",
  inputSchema: productListQuerySchema,
  outputSchema: z.custom<ProductListResult>(),
  requiredScopes: ["products:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return inventory(ctx).listProducts(query)
  },
})

const getProductArgs = z.object({ id: z.string().min(1).describe("The product id.") })
export type GetProductArgs = z.infer<typeof getProductArgs>

export const getProductTool = defineTool<
  GetProductArgs,
  { product: unknown | null },
  InventoryToolContext
>({
  name: "get_product",
  description: "Read a single product by id. Returns null when not found. Read-only.",
  inputSchema: getProductArgs,
  outputSchema: z.object({ product: z.unknown().nullable() }),
  requiredScopes: ["products:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    const product = await inventory(ctx).getProductById(id)
    return { product: product ?? null }
  },
})

/** All inventory agent tools, ready to register on a `ToolRegistry`. */
export const inventoryTools = [listProductsTool, getProductTool] as const
