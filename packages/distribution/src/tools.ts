/** Module-owned Tools for suppliers, distribution channels, and external references. */

import {
  insertSupplierSchema,
  selectSupplierSchema,
  supplierAggregatesQuerySchema,
  supplierListQuerySchema,
  updateSupplierSchema,
} from "@voyant-travel/suppliers-contracts"
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"
import {
  externalRefListQuerySchema,
  insertExternalRefSchema,
  selectExternalRefSchema,
  updateExternalRefSchema,
} from "./external-refs/validation.js"
import { channelSchema } from "./routes/openapi-schemas.js"
import { channelListQuerySchema, insertChannelSchema, updateChannelSchema } from "./validation.js"

const OWNER = "@voyant-travel/distribution"
const VERSION = "v1"
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const REVERSIBLE_WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: false,
  sideEffects: ["data-write"],
} as const

const idArgsSchema = z.object({ id: z.string().min(1) })
const supplierValueSchema = selectSupplierSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
const supplierAggregatesValueSchema = z.object({
  total: z.number().int(),
  countsByStatus: z.array(z.object({ status: z.string(), count: z.number().int() })),
  countsByType: z.array(z.object({ type: z.string(), count: z.number().int() })),
  active: z.number().int(),
})
const externalRefValueSchema = selectExternalRefSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
const updateSupplierToolSchema = updateSupplierSchema.extend({ id: z.string().min(1) })
const updateChannelToolSchema = updateChannelSchema.extend({ id: z.string().min(1) })
const updateExternalRefToolSchema = updateExternalRefSchema.extend({ id: z.string().min(1) })

type SupplierListQuery = z.infer<typeof supplierListQuerySchema>
type SupplierAggregatesQuery = z.infer<typeof supplierAggregatesQuerySchema>
type CreateSupplierInput = z.infer<typeof insertSupplierSchema>
type UpdateSupplierInput = z.infer<typeof updateSupplierToolSchema>
type ChannelListQuery = z.infer<typeof channelListQuerySchema>
type CreateChannelInput = z.infer<typeof insertChannelSchema>
type UpdateChannelInput = z.infer<typeof updateChannelToolSchema>
type ExternalRefListQuery = z.infer<typeof externalRefListQuerySchema>
type CreateExternalRefInput = z.infer<typeof insertExternalRefSchema>
type UpdateExternalRefInput = z.infer<typeof updateExternalRefToolSchema>

export interface DistributionToolServices {
  listSuppliers(query: SupplierListQuery): Promise<unknown>
  getSupplierById(id: string): Promise<unknown>
  getSupplierAggregates(query: SupplierAggregatesQuery): Promise<unknown>
  createSupplier(input: CreateSupplierInput): Promise<unknown>
  updateSupplier(input: UpdateSupplierInput): Promise<unknown>
  listChannels(query: ChannelListQuery): Promise<unknown>
  getChannelById(id: string): Promise<unknown>
  createChannel(input: CreateChannelInput): Promise<unknown>
  updateChannel(input: UpdateChannelInput): Promise<unknown>
  listExternalRefs(query: ExternalRefListQuery): Promise<unknown>
  getExternalRefById(id: string): Promise<unknown>
  createExternalRef(input: CreateExternalRefInput): Promise<unknown>
  updateExternalRef(input: UpdateExternalRefInput): Promise<unknown>
}

export type DistributionToolContext = ToolContext & { distribution?: DistributionToolServices }

function distribution(ctx: DistributionToolContext): DistributionToolServices {
  return requireService(ctx.distribution, "distribution")
}

function readMetadata(scopes: readonly string[]) {
  return {
    owner: OWNER,
    capabilityVersion: VERSION,
    requiredScopes: scopes,
    audience: STAFF_AUDIENCE,
    tier: "sensitive" as const,
    riskPolicy: READ_ONLY_RISK,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }
}

function writeMetadata(scopes: readonly string[]) {
  return {
    owner: OWNER,
    capabilityVersion: VERSION,
    requiredScopes: scopes,
    audience: STAFF_AUDIENCE,
    tier: "write" as const,
    riskPolicy: REVERSIBLE_WRITE_RISK,
  }
}

export const listSuppliersTool = defineTool({
  ...readMetadata(["suppliers:read"]),
  capabilityId: `${OWNER}#tool.list-suppliers`,
  name: "list_suppliers",
  description: "List supplier directory profiles, including operational contact details.",
  inputSchema: supplierListQuerySchema,
  outputSchema: listResponseSchema(supplierValueSchema),
  async handler(query, ctx: DistributionToolContext) {
    return parseJsonResult(
      listResponseSchema(supplierValueSchema),
      await distribution(ctx).listSuppliers(query),
    )
  },
})

export const getSupplierTool = defineTool({
  ...readMetadata(["suppliers:read"]),
  capabilityId: `${OWNER}#tool.get-supplier`,
  name: "get_supplier",
  description: "Read one supplier directory profile, including operational contact details.",
  inputSchema: idArgsSchema,
  outputSchema: supplierValueSchema.nullable(),
  async handler({ id }, ctx: DistributionToolContext) {
    return parseJsonResult(
      supplierValueSchema.nullable(),
      await distribution(ctx).getSupplierById(id),
    )
  },
})

export const getSupplierAggregatesTool = defineTool({
  ...readMetadata(["suppliers:read"]),
  capabilityId: `${OWNER}#tool.get-supplier-aggregates`,
  name: "get_supplier_aggregates",
  description: "Read supplier totals grouped by lifecycle status and supplier type.",
  inputSchema: supplierAggregatesQuerySchema,
  outputSchema: supplierAggregatesValueSchema,
  async handler(query, ctx: DistributionToolContext) {
    return parseJsonResult(
      supplierAggregatesValueSchema,
      await distribution(ctx).getSupplierAggregates(query),
    )
  },
})

export const createSupplierTool = defineTool({
  ...writeMetadata(["suppliers:write"]),
  capabilityId: `${OWNER}#tool.create-supplier`,
  name: "create_supplier",
  description: "Create a supplier directory profile and its primary operational identity data.",
  inputSchema: insertSupplierSchema,
  outputSchema: supplierValueSchema,
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(supplierValueSchema, await distribution(ctx).createSupplier(input))
  },
})

export const updateSupplierTool = defineTool({
  ...writeMetadata(["suppliers:write"]),
  capabilityId: `${OWNER}#tool.update-supplier`,
  name: "update_supplier",
  description: "Update a supplier profile and its managed operational identity data.",
  inputSchema: updateSupplierToolSchema,
  outputSchema: supplierValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(
      supplierValueSchema.nullable(),
      await distribution(ctx).updateSupplier(input),
    )
  },
})

export const listDistributionChannelsTool = defineTool({
  ...readMetadata(["distribution:read"]),
  capabilityId: `${OWNER}#tool.list-channels`,
  name: "list_distribution_channels",
  description: "List configured sales and distribution channels with their managed contacts.",
  inputSchema: channelListQuerySchema,
  outputSchema: listResponseSchema(channelSchema),
  async handler(query, ctx: DistributionToolContext) {
    return parseJsonResult(
      listResponseSchema(channelSchema),
      await distribution(ctx).listChannels(query),
    )
  },
})

export const getDistributionChannelTool = defineTool({
  ...readMetadata(["distribution:read"]),
  capabilityId: `${OWNER}#tool.get-channel`,
  name: "get_distribution_channel",
  description: "Read one configured sales or distribution channel with managed contact details.",
  inputSchema: idArgsSchema,
  outputSchema: channelSchema.nullable(),
  async handler({ id }, ctx: DistributionToolContext) {
    return parseJsonResult(channelSchema.nullable(), await distribution(ctx).getChannelById(id))
  },
})

export const createDistributionChannelTool = defineTool({
  ...writeMetadata(["distribution:write"]),
  capabilityId: `${OWNER}#tool.create-channel`,
  name: "create_distribution_channel",
  description: "Create a sales or distribution channel and its managed contact details.",
  inputSchema: insertChannelSchema,
  outputSchema: channelSchema,
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(channelSchema, await distribution(ctx).createChannel(input))
  },
})

export const updateDistributionChannelTool = defineTool({
  ...writeMetadata(["distribution:write"]),
  capabilityId: `${OWNER}#tool.update-channel`,
  name: "update_distribution_channel",
  description: "Update a sales or distribution channel and its managed contact details.",
  inputSchema: updateChannelToolSchema,
  outputSchema: channelSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(channelSchema.nullable(), await distribution(ctx).updateChannel(input))
  },
})

export const listExternalReferencesTool = defineTool({
  ...readMetadata(["external-refs:read"]),
  capabilityId: `${OWNER}#tool.list-external-references`,
  name: "list_external_references",
  description: "List mappings between domain records and identifiers in external systems.",
  inputSchema: externalRefListQuerySchema,
  outputSchema: listResponseSchema(externalRefValueSchema),
  async handler(query, ctx: DistributionToolContext) {
    return parseJsonResult(
      listResponseSchema(externalRefValueSchema),
      await distribution(ctx).listExternalRefs(query),
    )
  },
})

export const getExternalReferenceTool = defineTool({
  ...readMetadata(["external-refs:read"]),
  capabilityId: `${OWNER}#tool.get-external-reference`,
  name: "get_external_reference",
  description: "Read one mapping between a domain record and an external-system identifier.",
  inputSchema: idArgsSchema,
  outputSchema: externalRefValueSchema.nullable(),
  async handler({ id }, ctx: DistributionToolContext) {
    return parseJsonResult(
      externalRefValueSchema.nullable(),
      await distribution(ctx).getExternalRefById(id),
    )
  },
})

export const createExternalReferenceTool = defineTool({
  ...writeMetadata(["external-refs:write"]),
  capabilityId: `${OWNER}#tool.create-external-reference`,
  name: "create_external_reference",
  description: "Create an external-system identifier mapping for a domain record.",
  inputSchema: insertExternalRefSchema,
  outputSchema: externalRefValueSchema.nullable(),
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(
      externalRefValueSchema.nullable(),
      await distribution(ctx).createExternalRef(input),
    )
  },
})

export const updateExternalReferenceTool = defineTool({
  ...writeMetadata(["external-refs:write"]),
  capabilityId: `${OWNER}#tool.update-external-reference`,
  name: "update_external_reference",
  description: "Update an external-system identifier mapping for a domain record.",
  inputSchema: updateExternalRefToolSchema,
  outputSchema: externalRefValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: DistributionToolContext) {
    return parseJsonResult(
      externalRefValueSchema.nullable(),
      await distribution(ctx).updateExternalRef(input),
    )
  },
})

export const distributionTools = [
  listSuppliersTool,
  getSupplierTool,
  getSupplierAggregatesTool,
  createSupplierTool,
  updateSupplierTool,
  listDistributionChannelsTool,
  getDistributionChannelTool,
  createDistributionChannelTool,
  updateDistributionChannelTool,
  listExternalReferencesTool,
  getExternalReferenceTool,
  createExternalReferenceTool,
  updateExternalReferenceTool,
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
