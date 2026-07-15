/** Module-owned identity Tools for reusable contact, address, and named-contact data. */

import {
  addressListQuerySchema,
  contactPointListQuerySchema,
  insertAddressSchema,
  insertContactPointSchema,
  insertNamedContactSchema,
  namedContactListQuerySchema,
  selectAddressSchema,
  selectContactPointSchema,
  selectNamedContactSchema,
  updateAddressSchema,
  updateContactPointSchema,
  updateNamedContactSchema,
} from "@voyant-travel/identity-contracts"
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

const OWNER = "@voyant-travel/identity"
const VERSION = "v1"
const READ_SCOPES = ["identity:read"] as const
const WRITE_SCOPES = ["identity:write"] as const
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const SENSITIVE_WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  confirmationRequired: false,
  sideEffects: ["data-write"],
} as const

const idArgsSchema = z.object({ id: z.string().min(1) })
const contactPointValueSchema = selectContactPointSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
const addressValueSchema = selectAddressSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
const namedContactValueSchema = selectNamedContactSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })

const updateContactPointToolSchema = updateContactPointSchema.extend({ id: z.string().min(1) })
const updateAddressToolSchema = updateAddressSchema.extend({ id: z.string().min(1) })
const updateNamedContactToolSchema = updateNamedContactSchema.extend({ id: z.string().min(1) })

type ContactPointListQuery = z.infer<typeof contactPointListQuerySchema>
type AddressListQuery = z.infer<typeof addressListQuerySchema>
type NamedContactListQuery = z.infer<typeof namedContactListQuerySchema>
type CreateContactPointInput = z.infer<typeof insertContactPointSchema>
type CreateAddressInput = z.infer<typeof insertAddressSchema>
type CreateNamedContactInput = z.infer<typeof insertNamedContactSchema>
type UpdateContactPointInput = z.infer<typeof updateContactPointToolSchema>
type UpdateAddressInput = z.infer<typeof updateAddressToolSchema>
type UpdateNamedContactInput = z.infer<typeof updateNamedContactToolSchema>

export interface IdentityToolServices {
  listContactPoints(query: ContactPointListQuery): Promise<unknown>
  getContactPointById(id: string): Promise<unknown>
  createContactPoint(input: CreateContactPointInput): Promise<unknown>
  updateContactPoint(input: UpdateContactPointInput): Promise<unknown>
  listAddresses(query: AddressListQuery): Promise<unknown>
  getAddressById(id: string): Promise<unknown>
  createAddress(input: CreateAddressInput): Promise<unknown>
  updateAddress(input: UpdateAddressInput): Promise<unknown>
  listNamedContacts(query: NamedContactListQuery): Promise<unknown>
  getNamedContactById(id: string): Promise<unknown>
  createNamedContact(input: CreateNamedContactInput): Promise<unknown>
  updateNamedContact(input: UpdateNamedContactInput): Promise<unknown>
}

export type IdentityToolContext = ToolContext & { identity?: IdentityToolServices }

function identity(ctx: IdentityToolContext): IdentityToolServices {
  return requireService(ctx.identity, "identity")
}

const sensitiveReadMetadata = {
  owner: OWNER,
  capabilityVersion: VERSION,
  requiredScopes: READ_SCOPES,
  audience: STAFF_AUDIENCE,
  tier: "sensitive" as const,
  riskPolicy: READ_ONLY_RISK,
  annotations: { readOnlyHint: true, idempotentHint: true },
}

const sensitiveWriteMetadata = {
  owner: OWNER,
  capabilityVersion: VERSION,
  requiredScopes: WRITE_SCOPES,
  audience: STAFF_AUDIENCE,
  tier: "sensitive" as const,
  riskPolicy: SENSITIVE_WRITE_RISK,
}

export const listIdentityContactPointsTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.list-contact-points`,
  name: "list_identity_contact_points",
  description: "List reusable contact points for an entity. Contains personal contact data.",
  inputSchema: contactPointListQuerySchema,
  outputSchema: listResponseSchema(contactPointValueSchema),
  async handler(query, ctx: IdentityToolContext) {
    return parseJsonResult(
      listResponseSchema(contactPointValueSchema),
      await identity(ctx).listContactPoints(query),
    )
  },
})

export const getIdentityContactPointTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.get-contact-point`,
  name: "get_identity_contact_point",
  description: "Read one reusable contact point by id. Contains personal contact data.",
  inputSchema: idArgsSchema,
  outputSchema: contactPointValueSchema.nullable(),
  async handler({ id }, ctx: IdentityToolContext) {
    return parseJsonResult(
      contactPointValueSchema.nullable(),
      await identity(ctx).getContactPointById(id),
    )
  },
})

export const createIdentityContactPointTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.create-contact-point`,
  name: "create_identity_contact_point",
  description: "Create a reusable email, phone, messaging, or other contact point.",
  inputSchema: insertContactPointSchema,
  outputSchema: contactPointValueSchema.nullable(),
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(
      contactPointValueSchema.nullable(),
      await identity(ctx).createContactPoint(input),
    )
  },
})

export const updateIdentityContactPointTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.update-contact-point`,
  name: "update_identity_contact_point",
  description: "Update a reusable contact point, including its primary designation.",
  inputSchema: updateContactPointToolSchema,
  outputSchema: contactPointValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(
      contactPointValueSchema.nullable(),
      await identity(ctx).updateContactPoint(input),
    )
  },
})

export const listIdentityAddressesTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.list-addresses`,
  name: "list_identity_addresses",
  description: "List reusable postal or service addresses for an entity. Contains personal data.",
  inputSchema: addressListQuerySchema,
  outputSchema: listResponseSchema(addressValueSchema),
  async handler(query, ctx: IdentityToolContext) {
    return parseJsonResult(
      listResponseSchema(addressValueSchema),
      await identity(ctx).listAddresses(query),
    )
  },
})

export const getIdentityAddressTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.get-address`,
  name: "get_identity_address",
  description: "Read one reusable postal or service address by id. Contains personal data.",
  inputSchema: idArgsSchema,
  outputSchema: addressValueSchema.nullable(),
  async handler({ id }, ctx: IdentityToolContext) {
    return parseJsonResult(addressValueSchema.nullable(), await identity(ctx).getAddressById(id))
  },
})

export const createIdentityAddressTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.create-address`,
  name: "create_identity_address",
  description: "Create a reusable postal, billing, legal, meeting, or service address.",
  inputSchema: insertAddressSchema,
  outputSchema: addressValueSchema.nullable(),
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(addressValueSchema.nullable(), await identity(ctx).createAddress(input))
  },
})

export const updateIdentityAddressTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.update-address`,
  name: "update_identity_address",
  description: "Update a reusable address, including its label or primary designation.",
  inputSchema: updateAddressToolSchema,
  outputSchema: addressValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(addressValueSchema.nullable(), await identity(ctx).updateAddress(input))
  },
})

export const listIdentityNamedContactsTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.list-named-contacts`,
  name: "list_identity_named_contacts",
  description: "List named operational, sales, emergency, accounting, or legal contacts.",
  inputSchema: namedContactListQuerySchema,
  outputSchema: listResponseSchema(namedContactValueSchema),
  async handler(query, ctx: IdentityToolContext) {
    return parseJsonResult(
      listResponseSchema(namedContactValueSchema),
      await identity(ctx).listNamedContacts(query),
    )
  },
})

export const getIdentityNamedContactTool = defineTool({
  ...sensitiveReadMetadata,
  capabilityId: `${OWNER}#tool.get-named-contact`,
  name: "get_identity_named_contact",
  description: "Read one named operational contact by id. Contains personal contact data.",
  inputSchema: idArgsSchema,
  outputSchema: namedContactValueSchema.nullable(),
  async handler({ id }, ctx: IdentityToolContext) {
    return parseJsonResult(
      namedContactValueSchema.nullable(),
      await identity(ctx).getNamedContactById(id),
    )
  },
})

export const createIdentityNamedContactTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.create-named-contact`,
  name: "create_identity_named_contact",
  description: "Create a named operational, sales, emergency, accounting, or legal contact.",
  inputSchema: insertNamedContactSchema,
  outputSchema: namedContactValueSchema.nullable(),
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(
      namedContactValueSchema.nullable(),
      await identity(ctx).createNamedContact(input),
    )
  },
})

export const updateIdentityNamedContactTool = defineTool({
  ...sensitiveWriteMetadata,
  capabilityId: `${OWNER}#tool.update-named-contact`,
  name: "update_identity_named_contact",
  description: "Update a named contact, including role and primary designation.",
  inputSchema: updateNamedContactToolSchema,
  outputSchema: namedContactValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: IdentityToolContext) {
    return parseJsonResult(
      namedContactValueSchema.nullable(),
      await identity(ctx).updateNamedContact(input),
    )
  },
})

export const identityTools = [
  listIdentityContactPointsTool,
  getIdentityContactPointTool,
  createIdentityContactPointTool,
  updateIdentityContactPointTool,
  listIdentityAddressesTool,
  getIdentityAddressTool,
  createIdentityAddressTool,
  updateIdentityAddressTool,
  listIdentityNamedContactsTool,
  getIdentityNamedContactTool,
  createIdentityNamedContactTool,
  updateIdentityNamedContactTool,
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
