// Build a `WorkflowManifest` from collected workflow + event-filter entries.
//
// Called once at `createApp()` boot (PR4). The resulting manifest is
// content-addressed: byte-identical inputs produce byte-identical
// `versionId`s, so concurrent registration calls don't race meaningfully —
// the second caller sees the same versionId the first did.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §14.1.

import type {
  EventFilterManifestEntry,
  ManifestConcurrencyPolicy,
  ManifestSchedule,
  WorkflowManifest,
  WorkflowManifestEntry,
} from "../protocol/index.js"
import type { ConcurrencyPolicy, ScheduleDeclaration } from "../workflow.js"
import { canonicalJson, shortHash } from "./payload-hash.js"
import type { EventFilterRuntimeEntry } from "./registry.js"

export interface BuildManifestArgs {
  /** Project / tenant identifier. Single-tenant runtimes pass `"default"`. */
  projectId?: string
  /** Deployment environment. */
  environment: "production" | "preview" | "development"
  /** Workflow definitions collected from modules + plugins. */
  workflows: ReadonlyArray<{
    id: string
    config?: {
      defaultRuntime?: "edge" | "node"
      concurrency?: ConcurrencyPolicy<unknown>
      retry?: unknown
      timeout?: unknown
      schedule?: ScheduleDeclaration | ScheduleDeclaration[]
    }
  }>
  /** Event-filter entries from `getEventFilterRegistry()`. */
  eventFilters: ReadonlyArray<EventFilterRuntimeEntry>
  /** Wall-clock build time, ms-since-epoch. Defaults to `Date.now()`. */
  builtAt?: number
  /** Source-code version of the manifest builder. */
  builderVersion?: string
}

/**
 * Build a deterministic `WorkflowManifest`. Same inputs always produce
 * byte-identical output, including `versionId`.
 *
 * Does NOT write the manifest anywhere — that's the driver's
 * `registerManifest(...)` responsibility. This function is pure.
 */
export async function buildManifest(args: BuildManifestArgs): Promise<WorkflowManifest> {
  const builtAt = args.builtAt ?? Date.now()
  const builderVersion = args.builderVersion ?? "@voyantjs/workflows@manifest-builder/v1"
  const projectId = args.projectId ?? "default"

  const workflows: WorkflowManifestEntry[] = args.workflows
    .map((wf) => ({
      id: wf.id,
      version: "v1",
      steps: [],
      concurrency: serializeConcurrency(wf.config?.concurrency),
      schedules: serializeSchedules(wf.config?.schedule),
      defaultRuntime: wf.config?.defaultRuntime ?? "edge",
      hasCompensation: false,
      sourceLocation: { file: "<runtime>", line: 0 },
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  // Sort filters by id so the canonical form is order-independent.
  const eventFilters: EventFilterManifestEntry[] = args.eventFilters
    .map((entry) => entry.manifest)
    .sort((a, b) => a.id.localeCompare(b.id))

  const draft: Omit<WorkflowManifest, "versionId"> & { versionId?: string } = {
    schemaVersion: 1,
    projectId,
    builtAt,
    builderVersion,
    capabilities: ["events:v1"],
    workflows,
    eventFilters,
    bindings: {},
    environments: { production: {}, preview: {}, development: {} },
  }

  // versionId is the cryptographic short hash of the canonical manifest
  // body (excluding builtAt + versionId itself, which are non-load-bearing
  // for content identity).
  const identityBody = {
    schemaVersion: draft.schemaVersion,
    projectId: draft.projectId,
    builderVersion: draft.builderVersion,
    capabilities: draft.capabilities,
    workflows: draft.workflows,
    eventFilters: draft.eventFilters,
    bindings: draft.bindings,
    environments: draft.environments,
  }
  const versionId = await shortHash(identityBody)
  void canonicalJson // referenced via shortHash; keep the import surface stable

  return {
    ...(draft as Omit<WorkflowManifest, "versionId">),
    versionId,
  }
}

function serializeConcurrency(
  concurrency: ConcurrencyPolicy<unknown> | undefined,
): ManifestConcurrencyPolicy | undefined {
  if (!concurrency) return undefined
  const out: ManifestConcurrencyPolicy = {}
  if (typeof concurrency.key === "string") out.key = concurrency.key
  if (concurrency.limit !== undefined) out.limit = concurrency.limit
  if (concurrency.strategy !== undefined) out.strategy = concurrency.strategy
  return out
}

function serializeSchedules(
  schedule: ScheduleDeclaration | ScheduleDeclaration[] | undefined,
): ManifestSchedule[] {
  if (!schedule) return []
  const schedules = Array.isArray(schedule) ? schedule : [schedule]
  return schedules.map(serializeSchedule)
}

function serializeSchedule(schedule: ScheduleDeclaration): ManifestSchedule {
  const out: ManifestSchedule = {}
  if ("cron" in schedule) out.cron = schedule.cron
  if ("every" in schedule) out.every = schedule.every
  if ("at" in schedule) {
    out.at = schedule.at instanceof Date ? schedule.at.toISOString() : schedule.at
  }
  if (schedule.timezone !== undefined) out.timezone = schedule.timezone
  if (schedule.input !== undefined && typeof schedule.input !== "function")
    out.input = schedule.input
  if (schedule.enabled !== undefined) out.enabled = schedule.enabled
  if (schedule.overlap !== undefined) out.overlap = schedule.overlap
  if (schedule.environments !== undefined) out.environments = schedule.environments
  if (schedule.name !== undefined) out.name = schedule.name
  return out
}
