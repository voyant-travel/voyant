import type {
  EventEnvelope,
  EventFilterDescriptor,
  Module,
  ModuleContainer,
  WorkflowDescriptor,
} from "@voyantjs/core"
import type { WorkflowDriver } from "@voyantjs/workflows/driver"
import {
  type BuildManifestArgs,
  buildManifest,
  type EventFilterRuntimeEntry,
} from "@voyantjs/workflows/events"

import type { VoyantAppConfig } from "./types.js"

type ManifestWorkflowDescriptor = BuildManifestArgs["workflows"][number]

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
  // The descriptors collected from modules + plugins use core's structural
  // types (`{ id, eventType }` only - see `EventFilterDescriptor` in core);
  // the manifest builder needs the runtime shape with `.manifest` populated.
  // Validate before casting so a contract-violating plugin fails loudly here
  // instead of crashing on `entry.manifest.id` deep inside the sort.
  const filterEntries: EventFilterRuntimeEntry[] = []
  for (const entry of args.collectedFilters) {
    const candidate = entry as Partial<EventFilterRuntimeEntry>
    if (!candidate.manifest || typeof candidate.manifest.id !== "string") {
      throw new Error(
        `[voyant] event filter "${entry.id}" (event "${entry.eventType}") is missing the runtime ` +
          `\`manifest\` field. Filters must be produced via \`trigger.on(eventName, { ... })\` from ` +
          `@voyantjs/workflows - the public EventFilterDescriptor is the structural minimum, but ` +
          `createApp() needs the manifest payload to register with the driver.`,
      )
    }
    filterEntries.push(candidate as EventFilterRuntimeEntry)
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
  const eventTypes = new Set(filterEntries.map((f) => f.eventType))
  for (const eventType of eventTypes) {
    args.eventBus.subscribe(eventType, async (envelope: EventEnvelope) => {
      const stamped = ensureMetadataEventId(envelope)
      try {
        await args.driver.ingestEvent({
          environment: args.environment,
          envelope: stamped,
        })
      } catch (err) {
        // Subscribers are observers per the EventBus contract - a misbehaving
        // driver / network glitch must not break the emitter.
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[voyant] workflow forwarder for "${eventType}" failed: ${message}`)
      }
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
