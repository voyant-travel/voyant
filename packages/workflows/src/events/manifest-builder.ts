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
  WorkflowManifest,
  WorkflowManifestEntry,
} from "../protocol/index.js"
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
    config?: { defaultRuntime?: "edge" | "node"; retry?: unknown; timeout?: unknown }
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
      schedules: [],
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
