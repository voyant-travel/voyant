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
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import {
  createOptionExtraConfigTool as createOptionExtraConfigDefinition,
  createProductExtraTool as createProductExtraDefinition,
  getOptionExtraConfigTool as getOptionExtraConfigDefinition,
  getProductExtraTool as getProductExtraDefinition,
  listOptionExtraConfigsTool as listOptionExtraConfigsDefinition,
  listProductExtrasTool as listProductExtrasDefinition,
  updateOptionExtraConfigTool as updateOptionExtraConfigDefinition,
  updateProductExtraTool as updateProductExtraDefinition,
} from "./extras-tools.js"
import { productListQuerySchema } from "./validation.js"

type ProductListQuery = z.infer<typeof productListQuerySchema>

const productToolSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(["draft", "active", "archived"]),
    bookingMode: z.enum(["date", "date_time", "open", "stay", "transfer", "itinerary", "other"]),
    capacityMode: z.enum(["free_sale", "limited", "on_request"]),
    visibility: z.enum(["public", "private", "hidden"]),
    activated: z.boolean(),
    sellCurrency: z.string(),
    sellAmountCents: z.number().int().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    pax: z.number().int().nullable(),
    productTypeId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
const productListToolSchema = listResponseSchema(productToolSchema)
type ProductListToolResult = z.output<typeof productListToolSchema>

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
  getProductAggregates(query: { from?: string; to?: string }): Promise<unknown>
}

/** Tool context with the inventory service injected. */
export type InventoryToolContext = ToolContext & { inventory?: InventoryToolServices }

function inventory(ctx: InventoryToolContext): InventoryToolServices {
  return requireService(ctx.inventory, "inventory")
}

function constrainProductListQuery(query: ProductListQuery, ctx: ToolContext): ProductListQuery {
  if (ctx.actor === "staff") return query
  return { ...query, status: "active", visibility: "public", activated: true }
}

function isVisibleProduct(product: unknown, ctx: ToolContext): boolean {
  if (ctx.actor === "staff") return true
  if (!product || typeof product !== "object") return false
  const row = product as { status?: unknown; visibility?: unknown; activated?: unknown }
  return row.status === "active" && row.visibility === "public" && row.activated === true
}

export const listProductsTool = defineTool<
  z.infer<typeof productListQuerySchema>,
  ProductListToolResult,
  InventoryToolContext
>({
  name: "list_products",
  description:
    "List products with optional filters (status, booking mode, category, tag, search, " +
    "date range, price/pax bounds) and pagination. Returns { data, total, limit, offset }. " +
    "Read-only.",
  inputSchema: productListQuerySchema,
  outputSchema: productListToolSchema,
  requiredScopes: ["products:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return parseJsonResult(
      productListToolSchema,
      await inventory(ctx).listProducts(constrainProductListQuery(query, ctx)),
    )
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
  outputSchema: z.object({ product: productToolSchema.nullable() }),
  requiredScopes: ["products:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    const product = await inventory(ctx).getProductById(id)
    return parseJsonResult(z.object({ product: productToolSchema.nullable() }), {
      product: product && isVisibleProduct(product, ctx) ? product : null,
    })
  },
})

export const listProductExtrasTool = defineTool(listProductExtrasDefinition)
export const getProductExtraTool = defineTool(getProductExtraDefinition)
export const createProductExtraTool = defineTool(createProductExtraDefinition)
export const updateProductExtraTool = defineTool(updateProductExtraDefinition)
export const listOptionExtraConfigsTool = defineTool(listOptionExtraConfigsDefinition)
export const getOptionExtraConfigTool = defineTool(getOptionExtraConfigDefinition)
export const createOptionExtraConfigTool = defineTool(createOptionExtraConfigDefinition)
export const updateOptionExtraConfigTool = defineTool(updateOptionExtraConfigDefinition)

/** All inventory agent tools, ready to register on a `ToolRegistry`. */
export const inventoryTools = [listProductsTool, getProductTool] as const

function parseJsonResult<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(toJsonValue(value))
}

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}
