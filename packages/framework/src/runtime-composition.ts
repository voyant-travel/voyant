import type { EventEnvelope, EventFilterDescriptor, WorkflowDescriptor } from "@voyant-travel/core"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"

import type { VoyantGraphRuntime, VoyantGraphRuntimeUnitLoader } from "./runtime-lowering.js"

export interface VoyantGraphRuntimeBindingContext<TCapabilities> {
  capabilities: TCapabilities
  unit: VoyantGraphRuntimeUnitLoader
  runtimeExports: readonly unknown[]
}

export type VoyantGraphRuntimeBinding<TCapabilities> = (
  context: VoyantGraphRuntimeBindingContext<TCapabilities>,
) =>
  | HonoModule
  | readonly HonoModule[]
  | HonoExtension
  | readonly HonoExtension[]
  | undefined
  | Promise<
      HonoModule | readonly HonoModule[] | HonoExtension | readonly HonoExtension[] | undefined
    >

export type VoyantGraphRuntimeBindings<TCapabilities> = Readonly<
  Record<string, VoyantGraphRuntimeBinding<TCapabilities>>
>

export interface ComposeVoyantGraphRuntimeInput<TCapabilities> {
  runtime: VoyantGraphRuntime
  capabilities: TCapabilities
  /**
   * Deployment-owned option wiring and local units, keyed by stable graph unit
   * id. A binding only runs when its unit is selected by the generated graph.
   */
  bindings?: VoyantGraphRuntimeBindings<TCapabilities>
  /** Node-owned durable boundary for graph-selected outbound webhook events. */
  outboundWebhooks?: {
    enqueue: (event: EventEnvelope, bindings: unknown) => Promise<unknown>
  }
}

export interface VoyantGraphRuntimeComposition {
  modules: HonoModule[]
  extensions: HonoExtension[]
}

/** Load graph-owned workflow/subscriber metadata without composing API routes. */
export async function composeVoyantGraphRuntimeFacetModules(
  runtime: VoyantGraphRuntime,
): Promise<HonoModule[]> {
  const modules: HonoModule[] = []
  for (const unit of [...runtime.modules, ...runtime.extensions, ...runtime.plugins]) {
    const module = await resolveRuntimeFacetModule(unit)
    if (module) modules.push(module)
  }
  return modules
}

/**
 * Resolve selected graph runtime exports into the arrays consumed by mountApp.
 * Duplicate API facets are collapsed by the lowered unit loader before a
 * factory or deployment binding is invoked.
 */
export async function composeVoyantGraphRuntime<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
): Promise<VoyantGraphRuntimeComposition> {
  const modules: HonoModule[] = []
  const extensions: HonoExtension[] = []

  for (const unit of input.runtime.modules) {
    const outputs = await resolveRuntimeUnit(input, unit)
    assertWebhookRoutePosture(input.runtime, unit, outputs)
    for (const output of outputs) {
      if (!isHonoModule(output)) {
        throw invalidRuntimeOutput(unit, "HonoModule", output)
      }
      modules.push(output)
    }
  }

  for (const unit of [...input.runtime.extensions, ...input.runtime.plugins]) {
    const outputs = await resolveRuntimeUnit(input, unit)
    assertWebhookRoutePosture(input.runtime, unit, outputs)
    for (const output of outputs) {
      if (!isHonoExtension(output)) {
        throw invalidRuntimeOutput(unit, "HonoExtension", output)
      }
      extensions.push(output)
    }
  }

  modules.push(...(await composeVoyantGraphRuntimeFacetModules(input.runtime)))
  const outboundWebhookModule = createGraphOutboundWebhookModule(input)
  if (outboundWebhookModule) modules.push(outboundWebhookModule)

  return { modules, extensions }
}

function createGraphOutboundWebhookModule<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
): HonoModule | undefined {
  const enqueue = input.outboundWebhooks?.enqueue
  const eventTypes = input.runtime.webhooks.outboundEventTypes
  if (!enqueue || eventTypes.length === 0) return undefined

  return {
    module: {
      name: "graph-outbound-webhooks",
      bootstrap: ({ bindings, eventBus }) => {
        for (const eventType of eventTypes) {
          eventBus.subscribe(eventType, async (event) => {
            await enqueue(event, bindings)
          })
        }
      },
    },
  }
}

function assertWebhookRoutePosture(
  runtime: VoyantGraphRuntime,
  unit: VoyantGraphRuntimeUnitLoader,
  outputs: readonly unknown[],
): void {
  const declared = runtime.webhooks.inbound.some((entry) => entry.apiUnitId === unit.id)
  const executable = outputs.some(
    (output) => isRecord(output) && output.webhookRoutes !== undefined,
  )
  if (declared === executable) return

  throw new Error(
    declared
      ? `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" declares an inbound webhook plan but its runtime output has no webhookRoutes.`
      : `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" returned webhookRoutes without an inbound webhook declaration in the selected graph.`,
  )
}

async function resolveRuntimeFacetModule(
  unit: VoyantGraphRuntimeUnitLoader,
): Promise<HonoModule | undefined> {
  const workflows =
    unit.workflows.length > 0
      ? await Promise.all(unit.workflows.map((workflow) => workflow.load<WorkflowDescriptor>()))
      : await loadFacetReferences<WorkflowDescriptor>(unit, "workflows.runtime")
  const eventFilters = await loadFacetReferences<EventFilterDescriptor>(unit, "subscribers.runtime")
  if (workflows.length === 0 && eventFilters.length === 0) return undefined

  return {
    module: {
      name: `${unit.localId ?? unit.id}.graph-runtime`,
      ...(workflows.length > 0 ? { workflows } : {}),
      ...(eventFilters.length > 0 ? { eventFilters } : {}),
    },
  }
}

async function loadFacetReferences<T>(
  unit: VoyantGraphRuntimeUnitLoader,
  facet: "workflows.runtime" | "subscribers.runtime",
): Promise<T[]> {
  return Promise.all(
    unit.references
      .filter((reference) => reference.facet === facet)
      .map((reference) => reference.load<T>()),
  )
}

async function resolveRuntimeUnit<TCapabilities>(
  input: ComposeVoyantGraphRuntimeInput<TCapabilities>,
  unit: VoyantGraphRuntimeUnitLoader,
): Promise<unknown[]> {
  const runtimeExports = uniqueRuntimeExports(await unit.load())
  const binding = input.bindings?.[unit.id]
  if (binding) {
    return normalizeRuntimeOutputs(
      await binding({ capabilities: input.capabilities, unit, runtimeExports }),
    )
  }

  const outputs: unknown[] = []
  for (const runtimeExport of runtimeExports) {
    const output = typeof runtimeExport === "function" ? await runtimeExport() : runtimeExport
    outputs.push(...normalizeRuntimeOutputs(output))
  }
  return outputs
}

function uniqueRuntimeExports(runtimeExports: readonly unknown[]): unknown[] {
  const seen = new Set<unknown>()
  return runtimeExports.filter((runtimeExport) => {
    if (seen.has(runtimeExport)) return false
    seen.add(runtimeExport)
    return true
  })
}

function normalizeRuntimeOutputs(output: unknown): unknown[] {
  if (output === undefined) return []
  return Array.isArray(output) ? output : [output]
}

function isHonoModule(value: unknown): value is HonoModule {
  return isRecord(value) && isRecord(value.module) && isNonEmptyString(value.module.name)
}

function isHonoExtension(value: unknown): value is HonoExtension {
  return (
    isRecord(value) &&
    isRecord(value.extension) &&
    isNonEmptyString(value.extension.name) &&
    isNonEmptyString(value.extension.module)
  )
}

function invalidRuntimeOutput(
  unit: VoyantGraphRuntimeUnitLoader,
  expected: "HonoModule" | "HonoExtension",
  output: unknown,
): Error {
  return new Error(
    `composeVoyantGraphRuntime: ${unit.kind} "${unit.id}" must resolve to ${expected} output, got ${describeValue(output)}.`,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}
