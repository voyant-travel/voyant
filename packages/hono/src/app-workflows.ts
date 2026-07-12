import type {
  EventEnvelope,
  EventFilterDescriptor,
  EventFilterManifestDescriptor,
  Module,
  ModuleContainer,
  WorkflowDescriptor,
} from "@voyant-travel/core"
import type { WorkflowDriver } from "@voyant-travel/workflows/driver"
import type { BuildManifestArgs } from "@voyant-travel/workflows/events"

import type { VoyantAppConfig } from "./types.js"

type ManifestWorkflowDescriptor = BuildManifestArgs["workflows"][number]
type ManifestEventFilterEntry = {
  readonly id: string
  readonly eventType: string
  readonly manifest: EventFilterManifestDescriptor
  readonly declaration: { readonly target: { readonly id: string } }
  readonly targetWorkflowId: string
}

function toManifestWorkflowDescriptor(wf: WorkflowDescriptor): ManifestWorkflowDescriptor {
  const candidate = wf as WorkflowDescriptor & Partial<Pick<ManifestWorkflowDescriptor, "config">>
  return candidate.config ? { id: wf.id, config: candidate.config } : { id: wf.id }
}

export interface WireWorkflowRuntimeArgs {
  modules: ReadonlyArray<Module>
  collectedWorkflows: ReadonlyArray<WorkflowDescriptor>
  collectedFilters: ReadonlyArray<EventFilterDescriptor>
  driver: WorkflowDriver
  environment: "production" | "preview" | "development"
  projectId: string
  eventBus: {
    subscribe(event: string, handler: (e: EventEnvelope) => Promise<void> | void): unknown
  }
}

/**
 * Build the manifest, register it with the driver, and install a single
 * EventBus subscriber per unique eventType seen across the manifest's filters.
 */
export async function wireWorkflowRuntime(args: WireWorkflowRuntimeArgs): Promise<void> {
  // Keep app composition importable before workspace packages are built. The
  // workflow implementation is needed only when a configured app boots.
  const { buildManifest } = await import("@voyant-travel/workflows/events")

  // The descriptors collected from modules + plugins use core's structural
  // types (`{ id, eventType }` only - see `EventFilterDescriptor` in core);
  // the manifest builder needs the runtime shape with `.manifest` populated.
  // Validate before casting so a contract-violating plugin fails loudly here
  // instead of crashing on `entry.manifest.id` deep inside the sort.
  const filterEntries: ManifestEventFilterEntry[] = []
  for (const entry of args.collectedFilters) {
    const candidate = entry as EventFilterDescriptor
    if (!candidate.manifest || typeof candidate.manifest.id !== "string") {
      throw new Error(
        `[voyant] event filter "${entry.id}" (event "${entry.eventType}") is missing the runtime ` +
          `\`manifest\` field. Filters must be produced via \`trigger.on(eventName, { ... })\` from ` +
          `@voyant-travel/workflows - the public EventFilterDescriptor is the structural minimum, but ` +
          `createApp() needs the manifest payload to register with the driver.`,
      )
    }
    filterEntries.push({
      id: candidate.manifest.id,
      eventType: candidate.manifest.eventType,
      manifest: candidate.manifest,
      declaration: { target: { id: candidate.manifest.targetWorkflowId } },
      targetWorkflowId: candidate.manifest.targetWorkflowId,
    })
  }

  const manifest = await buildManifest({
    projectId: args.projectId,
    environment: args.environment,
    workflows: args.collectedWorkflows.map(toManifestWorkflowDescriptor),
    eventFilters: filterEntries,
  })

  await args.driver.registerManifest({
    environment: args.environment,
    manifest,
  })

  // Install one EventBus subscriber per unique eventType. Each subscriber
  // forwards the envelope through `driver.ingestEvent(...)`, which routes
  // through the same predicate/mapper machinery the HTTP ingest path uses.
  const eventTypes = new Set(filterEntries.map((f) => f.manifest.eventType))
  for (const eventType of eventTypes) {
    args.eventBus.subscribe(eventType, async (envelope: EventEnvelope) => {
      const stamped = ensureMetadataEventId(envelope)
      // Let ingest failures propagate: the EventBus catches every subscriber
      // throw (the emitter and sibling handlers stay unaffected per its
      // fire-and-forget contract) AND routes it through `onSubscriberError`, so
      // a misbehaving driver / network glitch is both logged and reported via
      // the framework reporter — instead of being swallowed here (RFC #1553).
      await args.driver.ingestEvent({
        environment: args.environment,
        envelope: stamped,
      })
    })
  }
}

/**
 * Adapt the framework's `ModuleContainer` to a read-only `ServiceResolver`.
 */
export function containerToServiceResolver(container: ModuleContainer): {
  resolve<T>(name: string): T
  has(name: string): boolean
} {
  return {
    resolve<T>(name: string): T {
      return container.resolve<T>(name)
    },
    has(name: string): boolean {
      return container.has(name)
    },
  }
}

/**
 * Adapt the framework's optional `LoggerProvider` to the workflow driver logger.
 */
export function makeFrameworkLogger(
  loggerProvider: VoyantAppConfig["logger"] | undefined,
): (level: "debug" | "info" | "warn" | "error", msg: string, data?: object) => void {
  void loggerProvider
  return (level, msg, data) => {
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log
    if (data !== undefined) fn(`[voyant] ${msg}`, data)
    else fn(`[voyant] ${msg}`)
  }
}

function ensureMetadataEventId(envelope: EventEnvelope): EventEnvelope {
  const metadata = envelope.metadata
  if (
    metadata !== undefined &&
    metadata !== null &&
    typeof metadata === "object" &&
    typeof (metadata as { eventId?: unknown }).eventId === "string" &&
    ((metadata as { eventId: string }).eventId.length ?? 0) > 0
  ) {
    return envelope
  }
  const eventId = `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")}`
  return {
    ...envelope,
    metadata: {
      ...(metadata ?? {}),
      eventId,
    },
  } as EventEnvelope
}
