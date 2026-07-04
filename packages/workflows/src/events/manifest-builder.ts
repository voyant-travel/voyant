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
  WorkflowDefinitionCapabilities,
  WorkflowManifest,
  WorkflowManifestBundle,
  WorkflowManifestDiagnostic,
  WorkflowManifestEntry,
  WorkflowReleaseCapabilities,
} from "../protocol/index.js"
import type { ConcurrencyPolicy, ScheduleDeclaration } from "../workflow.js"
import { canonicalJson, shortHash } from "./payload-hash.js"

export interface BuildManifestArgs {
  /** Project / tenant identifier. Single-tenant runtimes pass `"default"`. */
  projectId?: string
  /** Deployment environment. */
  environment: "production" | "preview" | "development"
  /** Workflow definitions collected from modules + plugins. */
  workflows: ReadonlyArray<{
    id: string
    config?: {
      description?: string
      input?: unknown
      output?: unknown
      defaultRuntime?: "node"
      concurrency?: ConcurrencyPolicy<unknown>
      retry?: unknown
      timeout?: unknown
      schedule?: ScheduleDeclaration | readonly ScheduleDeclaration[]
    }
  }>
  /** Event-filter entries from `trigger.on(...)` or manifest-only module metadata. */
  eventFilters: ReadonlyArray<{ readonly manifest: EventFilterManifestEntry }>
  /** Wall-clock build time, ms-since-epoch. Defaults to `Date.now()`. */
  builtAt?: number
  /** Source-code version of the manifest builder. */
  builderVersion?: string
  /** Workflow bundle metadata, when the build tool owns the artifact. */
  bundle?: WorkflowManifestBundle
  /** Build/import diagnostics surfaced to Cloud during release registration. */
  diagnostics?: ReadonlyArray<WorkflowManifestDiagnostic>
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
  const builderVersion = args.builderVersion ?? "@voyant-travel/workflows@manifest-builder"
  const projectId = args.projectId ?? "default"

  const eventFilters: EventFilterManifestEntry[] = args.eventFilters
    .map((entry) => entry.manifest)
    .sort((a, b) => a.id.localeCompare(b.id))
  const eventTargetWorkflowIds = new Set(eventFilters.map((filter) => filter.targetWorkflowId))

  const workflows: WorkflowManifestEntry[] = args.workflows
    .map((wf) => {
      const schedules = serializeSchedules(wf.config?.schedule)
      return {
        id: wf.id,
        displayName: displayNameFromId(wf.id),
        description: wf.config?.description,
        capabilities: workflowCapabilities({
          hasSchedules: schedules.length > 0,
          supportsEvents: eventTargetWorkflowIds.has(wf.id),
        }),
        version: "current",
        inputSchema: serializeSchema(wf.config?.input),
        outputSchema: serializeSchema(wf.config?.output),
        steps: [],
        concurrency: serializeConcurrency(wf.config?.concurrency),
        schedules,
        defaultRuntime: wf.config?.defaultRuntime ?? "node",
        hasCompensation: false,
        sourceLocation: { file: "<runtime>", line: 0 },
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const draft: Omit<WorkflowManifest, "versionId"> & { versionId?: string } = {
    schemaVersion: 1,
    projectId,
    builtAt,
    builderVersion,
    capabilities: releaseCapabilities(),
    workflows,
    eventFilters,
    diagnostics: [...(args.diagnostics ?? [])],
    bundle: args.bundle,
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
    diagnostics: draft.diagnostics,
    bundle: draft.bundle,
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

function releaseCapabilities(): WorkflowReleaseCapabilities {
  return {
    trigger: true,
    events: true,
    schedules: true,
    rerun: true,
    resume: true,
    cancel: true,
    humanApproval: true,
    stepRerun: false,
  }
}

function workflowCapabilities(args: {
  hasSchedules: boolean
  supportsEvents: boolean
}): WorkflowDefinitionCapabilities {
  return {
    canTrigger: true,
    canRerun: true,
    canResume: false,
    canCancel: true,
    hasSchedules: args.hasSchedules,
    supportsEvents: args.supportsEvents,
    supportsHumanApproval: false,
    supportsStepRerun: false,
  }
}

function serializeSchema(schema: unknown): unknown {
  if (schema === undefined) return undefined
  return zodToJsonSchema(schema) ?? schema
}

function zodToJsonSchema(schema: unknown): unknown | undefined {
  if (!isRecord(schema)) return undefined

  const instanceConverter = schema.toJSONSchema
  if (typeof instanceConverter === "function") {
    try {
      return instanceConverter.call(schema)
    } catch {
      // Fall through to the structural converter below.
    }
  }

  const def = zodDef(schema)
  if (!def) return undefined
  return zodDefToJsonSchema(schema)
}

function zodDefToJsonSchema(schema: unknown): unknown {
  const def = zodDef(schema)
  const typeName = zodTypeName(schema)

  if (typeName === "object") {
    const shape = zodObjectShape(def)
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const key of Object.keys(shape).sort()) {
      const child = shape[key]
      properties[key] = zodDefToJsonSchema(child)
      if (!zodIsOptional(child)) required.push(key)
    }

    const out: Record<string, unknown> = { type: "object", properties }
    if (required.length > 0) out.required = required
    return withDescription(schema, out)
  }

  if (typeName === "string") return withDescription(schema, { type: "string" })
  if (typeName === "number") return withDescription(schema, { type: "number" })
  if (typeName === "bigint") return withDescription(schema, { type: "integer" })
  if (typeName === "boolean") return withDescription(schema, { type: "boolean" })
  if (typeName === "date") return withDescription(schema, { type: "string", format: "date-time" })
  if (typeName === "null") return withDescription(schema, { type: "null" })
  if (
    typeName === "undefined" ||
    typeName === "void" ||
    typeName === "unknown" ||
    typeName === "any"
  ) {
    return withDescription(schema, {})
  }
  if (typeName === "never") return withDescription(schema, false)

  if (typeName === "array") {
    return withDescription(schema, {
      type: "array",
      items: zodDefToJsonSchema(def?.type ?? def?.element),
    })
  }

  if (typeName === "literal") {
    const value = Array.isArray(def?.values) ? def.values[0] : def?.value
    return withDescription(schema, { const: value })
  }

  if (typeName === "enum" || typeName === "nativeenum") {
    return withDescription(schema, {
      enum: zodEnumValues(def),
    })
  }

  if (typeName === "union" || typeName === "discriminatedunion") {
    const options = Array.isArray(def?.options) ? def.options : []
    return withDescription(schema, {
      anyOf: options.map((option) => zodDefToJsonSchema(option)),
    })
  }

  if (typeName === "record") {
    return withDescription(schema, {
      type: "object",
      additionalProperties: zodDefToJsonSchema(def?.valueType ?? def?.valueTypeDef),
    })
  }

  if (typeName === "optional") {
    return zodDefToJsonSchema(def?.innerType)
  }

  if (typeName === "nullable") {
    return withDescription(schema, {
      anyOf: [zodDefToJsonSchema(def?.innerType), { type: "null" }],
    })
  }

  if (
    typeName === "default" ||
    typeName === "catch" ||
    typeName === "branded" ||
    typeName === "readonly" ||
    typeName === "effects" ||
    typeName === "pipeline"
  ) {
    return zodDefToJsonSchema(def?.innerType ?? def?.type ?? def?.schema ?? def?.in)
  }

  return withDescription(schema, {})
}

function zodTypeName(schema: unknown): string | undefined {
  const def = zodDef(schema)
  const raw = typeof def?.type === "string" ? def.type : def?.typeName
  return typeof raw === "string" ? raw.replace(/^Zod/, "").toLowerCase() : undefined
}

function zodDef(schema: unknown): Record<string, unknown> | undefined {
  if (!isRecord(schema)) return undefined
  const def = schema._def ?? schema.def
  return isRecord(def) ? def : undefined
}

function zodObjectShape(def: Record<string, unknown> | undefined): Record<string, unknown> {
  const shape = def?.shape
  if (typeof shape === "function") {
    const result = shape()
    return isRecord(result) ? result : {}
  }
  return isRecord(shape) ? shape : {}
}

function zodEnumValues(def: Record<string, unknown> | undefined): unknown[] {
  if (Array.isArray(def?.values)) return def.values
  if (isRecord(def?.entries)) return Object.values(def.entries)
  if (isRecord(def?.values)) return Object.values(def.values)
  return []
}

function zodIsOptional(schema: unknown): boolean {
  const typeName = zodTypeName(schema)
  if (typeName === "optional" || typeName === "default") return true
  if (isRecord(schema) && typeof schema.isOptional === "function") {
    try {
      return schema.isOptional() === true
    } catch {
      return false
    }
  }
  return false
}

function withDescription(schema: unknown, jsonSchema: unknown): unknown {
  if (!isRecord(jsonSchema) || !isRecord(schema)) return jsonSchema
  const def = zodDef(schema)
  const description = typeof schema.description === "string" ? schema.description : def?.description
  if (typeof description !== "string") return jsonSchema
  return { ...jsonSchema, description }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function displayNameFromId(id: string): string {
  return id
    .split(/[._:-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
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
  schedule: ScheduleDeclaration | readonly ScheduleDeclaration[] | undefined,
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
