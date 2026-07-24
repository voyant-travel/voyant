/** Module-owned Tools for the MICE program lifecycle. */

import {
  admitHandlerActionPolicy,
  defineTool,
  type HandlerActionPolicyExpectation,
  READ_ONLY_RISK,
  requireService,
  type ToolContext,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import { z } from "zod"

import {
  createProgramSchema,
  programListQuerySchema,
  programStatusSchema,
  programTypeSchema,
  updateProgramSchema,
} from "./validation.js"

const OWNER = "@voyant-travel/mice"
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const READ_METADATA = {
  owner: OWNER,
  capabilityVersion: "v1",
  requiredScopes: ["mice:read"],
  audience: STAFF_AUDIENCE,
  tier: "read" as const,
  riskPolicy: READ_ONLY_RISK,
  annotations: { readOnlyHint: true, idempotentHint: true },
}
const WRITE_METADATA = {
  owner: OWNER,
  capabilityVersion: "v1",
  requiredScopes: ["mice:write"],
  audience: STAFF_AUDIENCE,
  tier: "write" as const,
  riskPolicy: {
    destructive: false,
    reversible: true,
    dryRunSupported: false,
    confirmationRequired: false,
    sideEffects: ["data-write"],
  },
} as const
export const CREATE_PROGRAM_HANDLER_POLICY = {
  capabilityId: `${OWNER}#tool.create-program`,
  capabilityVersion: "v1",
  canonicalName: "create_mice_program",
  actionPolicy: {
    id: `${OWNER}#action.create-program`,
    capabilityId: `${OWNER}#action.create-program`,
    version: "v1",
    kind: "execute",
    targetType: "mice-program",
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: "mice-program-create-command",
      resultReferenceType: "mice-program",
      durability: "handler-command-claim-v1",
    },
    risk: "medium",
    ledger: "required",
    approval: "never",
    reversible: false,
  },
} as const satisfies HandlerActionPolicyExpectation

const idArgsSchema = z.object({ id: z.string().min(1) })
const programValueSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  primaryContactPersonId: z.string().nullable(),
  accountManagerId: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  type: programTypeSchema,
  status: programStatusSchema,
  destination: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  estimatedPax: z.number().int().nullable(),
  confirmedPax: z.number().int().nullable(),
  currency: z.string().nullable(),
  budgetAmountCents: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
const programListValueSchema = z.object({
  data: z.array(programValueSchema),
  limit: z.number().int(),
  offset: z.number().int(),
})
const updateProgramToolSchema = updateProgramSchema.and(idArgsSchema)
export const createProgramToolSchema = createProgramSchema.extend({
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
})
const createProgramResultSchema = z.object({ programId: z.string() })

type ProgramListQuery = z.infer<typeof programListQuerySchema>
type CreateProgramInput = z.infer<typeof createProgramToolSchema>
type UpdateProgramInput = z.infer<typeof updateProgramToolSchema>

export interface MiceToolServices {
  listPrograms(query: ProgramListQuery): Promise<unknown>
  getProgram(id: string): Promise<unknown>
  createProgram(
    input: CreateProgramInput,
    admitted: ToolHandlerActionPolicyContext,
  ): Promise<unknown>
  updateProgram(input: UpdateProgramInput): Promise<unknown>
}

export type MiceToolContext = ToolContext & { mice?: MiceToolServices }

function mice(ctx: MiceToolContext): MiceToolServices {
  return requireService(ctx.mice, "mice")
}

export const listMiceProgramsTool = defineTool({
  ...READ_METADATA,
  capabilityId: `${OWNER}#tool.list-programs`,
  name: "list_mice_programs",
  description: "List staff-visible meetings, incentives, conferences, and exhibition programs.",
  inputSchema: programListQuerySchema,
  outputSchema: programListValueSchema,
  async handler(query, ctx: MiceToolContext) {
    return parseJsonResult(programListValueSchema, await mice(ctx).listPrograms(query))
  },
})

export const getMiceProgramTool = defineTool({
  ...READ_METADATA,
  capabilityId: `${OWNER}#tool.get-program`,
  name: "get_mice_program",
  description: "Read one MICE program, including buyer, dates, attendance, and budget fields.",
  inputSchema: idArgsSchema,
  outputSchema: programValueSchema.nullable(),
  async handler({ id }, ctx: MiceToolContext) {
    return parseJsonResult(programValueSchema.nullable(), await mice(ctx).getProgram(id))
  },
})

export const createMiceProgramTool = defineTool({
  ...WRITE_METADATA,
  capabilityId: `${OWNER}#tool.create-program`,
  name: "create_mice_program",
  description: "Create a MICE program with validated dates, lifecycle status, and budget data.",
  inputSchema: createProgramToolSchema,
  outputSchema: createProgramResultSchema,
  actionPolicyEnforcement: "handler",
  annotations: { idempotentHint: true },
  async handler(input, ctx: MiceToolContext) {
    const admitted = admitHandlerActionPolicy(ctx, CREATE_PROGRAM_HANDLER_POLICY)
    return createProgramResultSchema.parse(await mice(ctx).createProgram(input, admitted))
  },
})

export const updateMiceProgramTool = defineTool({
  ...WRITE_METADATA,
  capabilityId: `${OWNER}#tool.update-program`,
  name: "update_mice_program",
  description: "Update a MICE program's ownership, dates, lifecycle, attendance, or budget.",
  inputSchema: updateProgramToolSchema,
  outputSchema: programValueSchema.nullable(),
  annotations: { idempotentHint: true },
  async handler(input, ctx: MiceToolContext) {
    return parseJsonResult(programValueSchema.nullable(), await mice(ctx).updateProgram(input))
  },
})

export const miceTools = [
  listMiceProgramsTool,
  getMiceProgramTool,
  createMiceProgramTool,
  updateMiceProgramTool,
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
