import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import {
  type InitializeSetupInput,
  initializeSetupInputSchema,
  type SetupState,
  setupStateSchema,
  type SetupStepDefinition,
  setupStepDefinitionSchema,
  type SetupStepState,
  setupStepIdSchema,
  setupStepStateSchema,
} from "./contracts.js"
import type { InitializeSetupResult } from "./service.js"

const getSetupResultSchema = z.object({
  state: setupStateSchema.nullable(),
  selectedSteps: z.array(setupStepDefinitionSchema),
  canManage: z.boolean(),
})
const initializeSetupResultSchema = setupStateSchema.extend({ shouldRedirect: z.boolean() })
const stepMutationInputSchema = z.object({ stepId: setupStepIdSchema })

export interface SetupToolServices {
  get(): Promise<{
    state: SetupState | null
    selectedSteps: readonly SetupStepDefinition[]
    canManage: boolean
  }>
  initialize(input: InitializeSetupInput): Promise<InitializeSetupResult>
  complete(stepId: string): Promise<SetupStepState>
  skip(stepId: string): Promise<SetupStepState>
}

export type SetupToolContext = ToolContext & { setup?: SetupToolServices }

function setup(context: SetupToolContext): SetupToolServices {
  return requireService(context.setup, "setup")
}

export const getSetupStateTool = defineTool<
  Record<string, never>,
  { state: SetupState | null; selectedSteps: readonly SetupStepDefinition[]; canManage: boolean },
  SetupToolContext
>({
  name: "get_setup_state",
  aliases: ["read_setup_state"],
  description:
    "Read organization setup progress, graph-selected steps, and safe prefill data. Read-only.",
  inputSchema: z.object({}),
  outputSchema: getSetupResultSchema,
  requiredScopes: ["setup:read"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  handler: (_input, context) => setup(context).get(),
})

export const initializeSetupTool = defineTool<
  InitializeSetupInput,
  InitializeSetupResult,
  SetupToolContext
>({
  name: "initialize_setup",
  aliases: ["start_setup"],
  description:
    "Initialize organization setup using exactly the graph-selected step IDs returned by get_setup_state.",
  inputSchema: initializeSetupInputSchema,
  outputSchema: initializeSetupResultSchema,
  requiredScopes: ["setup:write"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "write",
  riskPolicy: {
    destructive: false,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: false,
    sideEffects: ["data-write"],
  },
  handler: (input, context) => setup(context).initialize(input),
})

export const completeSetupStepTool = defineTool<
  { stepId: string },
  SetupStepState,
  SetupToolContext
>({
  name: "complete_setup_step",
  aliases: ["mark_setup_step_complete"],
  description: "Mark one graph-selected organization setup step complete.",
  inputSchema: stepMutationInputSchema,
  outputSchema: setupStepStateSchema,
  requiredScopes: ["setup:write"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "write",
  riskPolicy: {
    destructive: false,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: false,
    sideEffects: ["data-write"],
  },
  handler: ({ stepId }, context) => setup(context).complete(stepId),
})

export const skipSetupStepTool = defineTool<
  { stepId: string },
  SetupStepState,
  SetupToolContext
>({
  name: "skip_setup_step",
  aliases: ["mark_setup_step_skipped"],
  description: "Skip one graph-selected organization setup step when that step is skippable.",
  inputSchema: stepMutationInputSchema,
  outputSchema: setupStepStateSchema,
  requiredScopes: ["setup:write"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "write",
  riskPolicy: {
    destructive: false,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: false,
    sideEffects: ["data-write"],
  },
  handler: ({ stepId }, context) => setup(context).skip(stepId),
})

export const setupTools = [
  getSetupStateTool,
  initializeSetupTool,
  completeSetupStepTool,
  skipSetupStepTool,
] as const
