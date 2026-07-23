/** Module-owned Tools for product extras and option-level extra configuration. */

import {
  admitHandlerActionPolicy,
  defineTool,
  type HandlerActionPolicyExpectation,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import {
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigCoreSchema,
  optionExtraConfigListQuerySchema,
  productExtraCoreSchema,
  productExtraListQuerySchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./extras/validation.js"

const OWNER = "@voyant-travel/inventory#extras"
const VERSION = "v1"
const READ_SCOPES = ["extras:read"] as const
const WRITE_SCOPES = ["extras:write"] as const
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: false,
  sideEffects: ["data-write"],
} as const

const idArgsSchema = z.object({ id: z.string().min(1) })
const productExtraValueSchema = productExtraCoreSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
const optionExtraConfigValueSchema = optionExtraConfigCoreSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
const updateProductExtraToolSchema = updateProductExtraSchema.extend({ id: z.string().min(1) })
const updateOptionExtraConfigToolSchema = updateOptionExtraConfigSchema.extend({
  id: z.string().min(1),
})

type ProductExtraListInput = z.infer<typeof productExtraListQuerySchema>
type OptionExtraConfigListInput = z.infer<typeof optionExtraConfigListQuerySchema>
const idempotencyKeySchema = z.string().trim().min(1).max(255)
export const createProductExtraInputSchema = insertProductExtraSchema.extend({
  idempotencyKey: idempotencyKeySchema,
})
export const createOptionExtraConfigInputSchema = insertOptionExtraConfigSchema.extend({
  idempotencyKey: idempotencyKeySchema,
})
const createdChildReferenceSchema = z.object({ id: z.string(), replayed: z.boolean() })

type CreateProductExtraInput = z.infer<typeof createProductExtraInputSchema>
type UpdateProductExtraInput = z.infer<typeof updateProductExtraToolSchema>
type CreateOptionExtraConfigInput = z.infer<typeof createOptionExtraConfigInputSchema>
type UpdateOptionExtraConfigInput = z.infer<typeof updateOptionExtraConfigToolSchema>

export interface InventoryExtrasToolServices {
  listProductExtras(input: ProductExtraListInput): Promise<unknown>
  getProductExtraById(id: string): Promise<unknown>
  createProductExtra(
    input: CreateProductExtraInput,
    admitted: ToolHandlerActionPolicyContext,
  ): Promise<unknown>
  updateProductExtra(input: UpdateProductExtraInput): Promise<unknown>
  listOptionExtraConfigs(input: OptionExtraConfigListInput): Promise<unknown>
  getOptionExtraConfigById(id: string): Promise<unknown>
  createOptionExtraConfig(
    input: CreateOptionExtraConfigInput,
    admitted: ToolHandlerActionPolicyContext,
  ): Promise<unknown>
  updateOptionExtraConfig(input: UpdateOptionExtraConfigInput): Promise<unknown>
}

export type InventoryExtrasToolContext = ToolContext & {
  inventoryExtras?: InventoryExtrasToolServices
}

function extras(ctx: InventoryExtrasToolContext): InventoryExtrasToolServices {
  return requireService(ctx.inventoryExtras, "inventoryExtras")
}

const readMetadata = {
  owner: OWNER,
  capabilityVersion: VERSION,
  requiredScopes: READ_SCOPES,
  audience: STAFF_AUDIENCE,
  tier: "read" as const,
  riskPolicy: READ_ONLY_RISK,
  annotations: { readOnlyHint: true, idempotentHint: true },
}
const writeMetadata = {
  owner: OWNER,
  capabilityVersion: VERSION,
  requiredScopes: WRITE_SCOPES,
  audience: STAFF_AUDIENCE,
  tier: "sensitive" as const,
  riskPolicy: WRITE_RISK,
}

export const CREATE_PRODUCT_EXTRA_HANDLER_POLICY = {
  capabilityId: `${OWNER}.tool.create-product-extra`,
  capabilityVersion: VERSION,
  canonicalName: "create_product_extra",
  actionPolicy: {
    id: `${OWNER}.action.create-product-extra`,
    capabilityId: `${OWNER}.action.create-product-extra`,
    version: VERSION,
    kind: "execute",
    targetType: "product_extra",
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: "product-extra-create-command",
      resultReferenceType: "product_extra",
      durability: "handler-command-claim-v1",
      parentAnchor: { targetType: "product", targetIdField: "productId" },
    },
    risk: "high",
    ledger: "required",
    approval: "never",
    reversible: false,
    allowedActorTypes: ["staff"],
  },
} as const satisfies HandlerActionPolicyExpectation

export const CREATE_OPTION_EXTRA_CONFIG_HANDLER_POLICY = {
  capabilityId: `${OWNER}.tool.create-option-extra-config`,
  capabilityVersion: VERSION,
  canonicalName: "create_option_extra_config",
  actionPolicy: {
    id: `${OWNER}.action.create-option-extra-config`,
    capabilityId: `${OWNER}.action.create-option-extra-config`,
    version: VERSION,
    kind: "execute",
    targetType: "option_extra_config",
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: "option-extra-config-create-command",
      resultReferenceType: "option_extra_config",
      durability: "handler-command-claim-v1",
      parentAnchor: {
        targetType: "product_extra",
        targetIdField: "productExtraId",
        relatedTargetIdField: "optionId",
      },
    },
    risk: "high",
    ledger: "required",
    approval: "never",
    reversible: false,
    allowedActorTypes: ["staff"],
  },
} as const satisfies HandlerActionPolicyExpectation

export const listProductExtrasTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}.tool.list-product-extras`,
  name: "list_product_extras",
  description: "List optional, required, included, or unavailable extras authored for products.",
  inputSchema: productExtraListQuerySchema,
  outputSchema: listResponseSchema(productExtraValueSchema),
  async handler(input, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      listResponseSchema(productExtraValueSchema),
      await extras(ctx).listProductExtras(input),
    )
  },
})

export const getProductExtraTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}.tool.get-product-extra`,
  name: "get_product_extra",
  description: "Read one product extra and its selection, pricing, and collection defaults.",
  inputSchema: idArgsSchema,
  outputSchema: productExtraValueSchema.nullable(),
  async handler({ id }, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      productExtraValueSchema.nullable(),
      await extras(ctx).getProductExtraById(id),
    )
  },
})

export const createProductExtraTool = defineTool({
  ...writeMetadata,
  riskPolicy: { ...WRITE_RISK, reversible: false },
  capabilityId: `${OWNER}.tool.create-product-extra`,
  name: "create_product_extra",
  description: "Create an authored product extra with selection, pricing, and collection defaults.",
  inputSchema: createProductExtraInputSchema,
  outputSchema: createdChildReferenceSchema,
  actionPolicyEnforcement: "handler",
  async handler(input, ctx: InventoryExtrasToolContext) {
    const admitted = admitHandlerActionPolicy(ctx, CREATE_PRODUCT_EXTRA_HANDLER_POLICY)
    return createdChildReferenceSchema.parse(await extras(ctx).createProductExtra(input, admitted))
  },
})

export const updateProductExtraTool = defineTool({
  ...writeMetadata,
  capabilityId: `${OWNER}.tool.update-product-extra`,
  name: "update_product_extra",
  description: "Update a product extra without deleting historical booking references.",
  inputSchema: updateProductExtraToolSchema,
  outputSchema: productExtraValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      productExtraValueSchema.nullable(),
      await extras(ctx).updateProductExtra(input),
    )
  },
})

export const listOptionExtraConfigsTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}.tool.list-option-extra-configs`,
  name: "list_option_extra_configs",
  description: "List option-specific overrides for product extra selection and pricing behavior.",
  inputSchema: optionExtraConfigListQuerySchema,
  outputSchema: listResponseSchema(optionExtraConfigValueSchema),
  async handler(input, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      listResponseSchema(optionExtraConfigValueSchema),
      await extras(ctx).listOptionExtraConfigs(input),
    )
  },
})

export const getOptionExtraConfigTool = defineTool({
  ...readMetadata,
  capabilityId: `${OWNER}.tool.get-option-extra-config`,
  name: "get_option_extra_config",
  description: "Read one option-specific product extra configuration.",
  inputSchema: idArgsSchema,
  outputSchema: optionExtraConfigValueSchema.nullable(),
  async handler({ id }, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      optionExtraConfigValueSchema.nullable(),
      await extras(ctx).getOptionExtraConfigById(id),
    )
  },
})

export const createOptionExtraConfigTool = defineTool({
  ...writeMetadata,
  riskPolicy: { ...WRITE_RISK, reversible: false },
  capabilityId: `${OWNER}.tool.create-option-extra-config`,
  name: "create_option_extra_config",
  description: "Create option-level selection or pricing overrides for a product extra.",
  inputSchema: createOptionExtraConfigInputSchema,
  outputSchema: createdChildReferenceSchema,
  actionPolicyEnforcement: "handler",
  async handler(input, ctx: InventoryExtrasToolContext) {
    const admitted = admitHandlerActionPolicy(ctx, CREATE_OPTION_EXTRA_CONFIG_HANDLER_POLICY)
    return createdChildReferenceSchema.parse(
      await extras(ctx).createOptionExtraConfig(input, admitted),
    )
  },
})

export const updateOptionExtraConfigTool = defineTool({
  ...writeMetadata,
  capabilityId: `${OWNER}.tool.update-option-extra-config`,
  name: "update_option_extra_config",
  description: "Update option-level product extra overrides.",
  inputSchema: updateOptionExtraConfigToolSchema,
  outputSchema: optionExtraConfigValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: InventoryExtrasToolContext) {
    return parseJsonResult(
      optionExtraConfigValueSchema.nullable(),
      await extras(ctx).updateOptionExtraConfig(input),
    )
  },
})

export const inventoryExtrasTools = [
  listProductExtrasTool,
  getProductExtraTool,
  createProductExtraTool,
  updateProductExtraTool,
  listOptionExtraConfigsTool,
  getOptionExtraConfigTool,
  createOptionExtraConfigTool,
  updateOptionExtraConfigTool,
] as const

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
