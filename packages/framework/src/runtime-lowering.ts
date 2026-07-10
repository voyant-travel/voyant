import type {
  VoyantGraphRouteBundle,
  VoyantGraphRuntimeReference,
  VoyantGraphUnitKind,
} from "@voyant-travel/core/project"

export type VoyantGraphRuntimeReferenceFacet =
  | "api"
  | "config.validator"
  | "secrets.validator"
  | "providers.runtime"
  | "admin.copy.runtime"
  | "admin.routes.runtime"
  | "admin.contributions.runtime"
  | "tools.runtime"

export interface VoyantGraphRuntimeReferenceDefinition {
  /** Stable graph-scoped identifier used by generic runtime consumers. */
  id: string
  unitId: string
  facet: VoyantGraphRuntimeReferenceFacet
  entityId: string
  runtime: VoyantGraphRuntimeReference
  /** Package import specifier after owner-relative references have been lowered. */
  importEntry: string
}

export const VOYANT_GRAPH_RUNTIME_LOAD_ERROR_CODES = {
  VOYANT_GRAPH_RUNTIME_REFERENCE_UNKNOWN:
    "A runtime reference is not present in the admitted generated graph.",
  VOYANT_GRAPH_RUNTIME_IMPORT_FAILED:
    "A lowered graph runtime package entry could not be imported.",
  VOYANT_GRAPH_RUNTIME_EXPORT_MISSING:
    "A lowered graph runtime package entry does not contain the declared export.",
  VOYANT_GRAPH_RUNTIME_EXPORT_INVALID:
    "A lowered graph runtime package export is not a runtime object or factory.",
} as const

export type VoyantGraphRuntimeLoadErrorCode = keyof typeof VOYANT_GRAPH_RUNTIME_LOAD_ERROR_CODES

export interface VoyantGraphRuntimeLoadErrorContext {
  referenceId: string
  unitId?: string
  facet?: VoyantGraphRuntimeReferenceFacet
  entityId?: string
  routeId?: string
  entry?: string
  exportName?: string
}

export class VoyantGraphRuntimeLoadError extends Error {
  readonly code: VoyantGraphRuntimeLoadErrorCode
  readonly context: VoyantGraphRuntimeLoadErrorContext
  override readonly cause?: unknown

  constructor(
    code: VoyantGraphRuntimeLoadErrorCode,
    context: VoyantGraphRuntimeLoadErrorContext,
    detail: string,
    cause?: unknown,
  ) {
    super(formatRuntimeLoadError(code, context, detail))
    this.name = "VoyantGraphRuntimeLoadError"
    this.code = code
    this.context = context
    this.cause = cause
  }
}

export interface VoyantGraphRuntimeRouteDefinition {
  route: VoyantGraphRouteBundle
  /** Package import specifier after owner-relative references have been lowered. */
  importEntry: string
  referenceId?: string
}

export interface VoyantGraphRuntimeUnitDefinition {
  id: string
  kind: VoyantGraphUnitKind
  packageName: string
  order: number
  references?: readonly VoyantGraphRuntimeReferenceDefinition[]
  routes: readonly VoyantGraphRuntimeRouteDefinition[]
}

export interface VoyantGraphRuntimeRouteLoader extends VoyantGraphRuntimeRouteDefinition {
  load: () => Promise<unknown>
}

export interface VoyantGraphRuntimeReferenceLoader extends VoyantGraphRuntimeReferenceDefinition {
  load: <T = unknown>() => Promise<T>
}

export interface VoyantGraphRuntimeUnitLoader
  extends Omit<VoyantGraphRuntimeUnitDefinition, "routes"> {
  references: readonly VoyantGraphRuntimeReferenceLoader[]
  routes: readonly VoyantGraphRuntimeRouteLoader[]
  /** Load each distinct package entry/export reference in this unit once. */
  load: () => Promise<readonly unknown[]>
}

export interface VoyantGraphRuntime {
  graphHash: string
  modules: readonly VoyantGraphRuntimeUnitLoader[]
  plugins: readonly VoyantGraphRuntimeUnitLoader[]
  references: readonly VoyantGraphRuntimeReferenceLoader[]
  loadReference: <T = unknown>(referenceId: string) => Promise<T>
}

export interface CreateVoyantGraphRuntimeInput {
  graphHash: string
  entries: Readonly<Record<string, () => Promise<unknown>>>
  modules: readonly VoyantGraphRuntimeUnitDefinition[]
  plugins: readonly VoyantGraphRuntimeUnitDefinition[]
}

/**
 * Turn generated graph metadata and static import closures into lazy runtime
 * loaders. Target adapters decide how to invoke the loaded package exports.
 */
export function createVoyantGraphRuntime(input: CreateVoyantGraphRuntimeInput): VoyantGraphRuntime {
  const definitions = normalizeRuntimeDefinition(input)
  const usedEntries = validateRuntimeDefinition(definitions)
  const importEntries = new Map<string, () => Promise<unknown>>()

  for (const entry of usedEntries) {
    const importEntry = input.entries[entry]
    if (!importEntry) {
      throw new Error(
        `createVoyantGraphRuntime: no lazy importer was generated for runtime entry "${entry}".`,
      )
    }
    importEntries.set(entry, memoizePromise(importEntry))
  }

  const modules = definitions.modules.map((unit) => createRuntimeUnitLoader(unit, importEntries))
  const plugins = definitions.plugins.map((unit) => createRuntimeUnitLoader(unit, importEntries))
  const references = [...modules, ...plugins].flatMap((unit) => unit.references)
  const referenceById = new Map(references.map((reference) => [reference.id, reference]))

  return {
    graphHash: input.graphHash,
    modules,
    plugins,
    references,
    loadReference: async <T = unknown>(referenceId: string): Promise<T> => {
      const reference = referenceById.get(referenceId)
      if (!reference) {
        throw new VoyantGraphRuntimeLoadError(
          "VOYANT_GRAPH_RUNTIME_REFERENCE_UNKNOWN",
          { referenceId },
          "the reference is not present in the admitted generated graph",
        )
      }
      return reference.load<T>()
    },
  }
}

interface NormalizedVoyantGraphRuntimeUnitDefinition
  extends Omit<VoyantGraphRuntimeUnitDefinition, "references" | "routes"> {
  references: readonly VoyantGraphRuntimeReferenceDefinition[]
  routes: readonly (VoyantGraphRuntimeRouteDefinition & { referenceId: string })[]
}

interface NormalizedVoyantGraphRuntimeInput
  extends Omit<CreateVoyantGraphRuntimeInput, "modules" | "plugins"> {
  modules: readonly NormalizedVoyantGraphRuntimeUnitDefinition[]
  plugins: readonly NormalizedVoyantGraphRuntimeUnitDefinition[]
}

function normalizeRuntimeDefinition(
  input: CreateVoyantGraphRuntimeInput,
): NormalizedVoyantGraphRuntimeInput {
  return {
    ...input,
    modules: input.modules.map(normalizeRuntimeUnitDefinition),
    plugins: input.plugins.map(normalizeRuntimeUnitDefinition),
  }
}

function normalizeRuntimeUnitDefinition(
  unit: VoyantGraphRuntimeUnitDefinition,
): NormalizedVoyantGraphRuntimeUnitDefinition {
  const references = [...(unit.references ?? [])]
  const referenceIds = new Set(references.map((reference) => reference.id))

  const routes = unit.routes.map((definition) => {
    const runtime = definition.route.runtime
    if (!runtime) return { ...definition, referenceId: definition.referenceId ?? "" }
    if (definition.referenceId) {
      if (!referenceIds.has(definition.referenceId)) {
        throw new Error(
          `createVoyantGraphRuntime: route "${definition.route.id}" selects unknown runtime reference "${definition.referenceId}".`,
        )
      }
      return { ...definition, referenceId: definition.referenceId }
    }
    const referenceId = legacyRouteReferenceId(unit.id, definition.route.id)
    references.push({
      id: referenceId,
      unitId: unit.id,
      facet: "api",
      entityId: definition.route.id,
      runtime,
      importEntry: definition.importEntry,
    })
    referenceIds.add(referenceId)
    return { ...definition, referenceId }
  })

  return { ...unit, references, routes }
}

function createRuntimeUnitLoader(
  unit: NormalizedVoyantGraphRuntimeUnitDefinition,
  entries: ReadonlyMap<string, () => Promise<unknown>>,
): VoyantGraphRuntimeUnitLoader {
  const references = unit.references.map((definition) =>
    createRuntimeReferenceLoader(definition, entries),
  )
  const referenceById = new Map(references.map((reference) => [reference.id, reference]))
  const routes = unit.routes.map((definition) => {
    const reference = definition.referenceId ? referenceById.get(definition.referenceId) : undefined
    if (!reference) {
      throw new Error(
        `createVoyantGraphRuntime: runtime reference "${String(definition.referenceId)}" for route "${definition.route.id}" is not registered.`,
      )
    }
    return {
      ...definition,
      load: reference.load,
    }
  })

  return {
    id: unit.id,
    kind: unit.kind,
    packageName: unit.packageName,
    order: unit.order,
    references,
    routes,
    load: memoizePromise(() =>
      Promise.all(uniqueRuntimeRouteLoaders(routes).map((route) => route.load())),
    ),
  }
}

function createRuntimeReferenceLoader(
  definition: VoyantGraphRuntimeReferenceDefinition,
  entries: ReadonlyMap<string, () => Promise<unknown>>,
): VoyantGraphRuntimeReferenceLoader {
  const importEntry = entries.get(definition.importEntry)
  if (!importEntry) {
    throw new Error(
      `createVoyantGraphRuntime: runtime entry "${definition.importEntry}" for reference "${definition.id}" is not registered.`,
    )
  }
  const load = memoizePromise(() => loadRuntimeReferenceExport(definition, importEntry))
  return {
    ...definition,
    load: <T = unknown>() => load() as Promise<T>,
  }
}

function uniqueRuntimeRouteLoaders(
  routes: readonly VoyantGraphRuntimeRouteLoader[],
): VoyantGraphRuntimeRouteLoader[] {
  const seen = new Set<string>()
  return routes.filter((route) => {
    const key = JSON.stringify([route.importEntry, route.route.runtime?.export ?? null])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadRuntimeReferenceExport(
  definition: VoyantGraphRuntimeReferenceDefinition,
  importEntry: () => Promise<unknown>,
): Promise<unknown> {
  const runtime = definition.runtime
  const context: VoyantGraphRuntimeLoadErrorContext = {
    referenceId: definition.id,
    unitId: definition.unitId,
    facet: definition.facet,
    entityId: definition.entityId,
    ...(definition.facet === "api" ? { routeId: definition.entityId } : {}),
    entry: definition.importEntry,
    ...(runtime.export ? { exportName: runtime.export } : {}),
  }

  let namespace: unknown
  try {
    namespace = await importEntry()
  } catch (error) {
    throw new VoyantGraphRuntimeLoadError(
      "VOYANT_GRAPH_RUNTIME_IMPORT_FAILED",
      context,
      errorMessage(error),
      error,
    )
  }

  if (!isRecord(namespace)) {
    throw new VoyantGraphRuntimeLoadError(
      "VOYANT_GRAPH_RUNTIME_EXPORT_INVALID",
      context,
      "the package import did not return a module namespace object",
    )
  }

  if (!runtime.export) return namespace
  if (!Object.hasOwn(namespace, runtime.export)) {
    throw new VoyantGraphRuntimeLoadError(
      "VOYANT_GRAPH_RUNTIME_EXPORT_MISSING",
      context,
      `export "${runtime.export}" was not found`,
    )
  }

  const value = namespace[runtime.export]
  if (!isRuntimeExport(value)) {
    throw new VoyantGraphRuntimeLoadError(
      "VOYANT_GRAPH_RUNTIME_EXPORT_INVALID",
      context,
      `export "${runtime.export}" must be a runtime object or factory, got ${describeValue(value)}`,
    )
  }
  return value
}

function validateRuntimeDefinition(input: NormalizedVoyantGraphRuntimeInput): string[] {
  if (!input.graphHash.trim()) {
    throw new Error("createVoyantGraphRuntime: graphHash must be a non-empty string.")
  }

  const usedEntries = new Set<string>()
  const referenceIds = new Set<string>()
  for (const [expectedKind, units] of [
    ["module", input.modules],
    ["plugin", input.plugins],
  ] as const) {
    for (const unit of units) {
      if (unit.kind !== expectedKind) {
        throw new Error(
          `createVoyantGraphRuntime: ${expectedKind} loader "${unit.id}" declares kind "${unit.kind}".`,
        )
      }
      for (const reference of unit.references) {
        if (reference.unitId !== unit.id) {
          throw new Error(
            `createVoyantGraphRuntime: reference "${reference.id}" belongs to unit "${reference.unitId}", not "${unit.id}".`,
          )
        }
        if (referenceIds.has(reference.id)) {
          throw new Error(
            `createVoyantGraphRuntime: duplicate runtime reference id "${reference.id}".`,
          )
        }
        referenceIds.add(reference.id)
        usedEntries.add(reference.importEntry)
      }
      for (const definition of unit.routes) {
        if (!definition.route.runtime) {
          throw new Error(
            `createVoyantGraphRuntime: route "${definition.route.id}" does not declare a runtime reference.`,
          )
        }
      }
    }
  }
  return [...usedEntries].sort((left, right) => left.localeCompare(right))
}

function legacyRouteReferenceId(unitId: string, routeId: string): string {
  return `legacy:${encodeURIComponent(unitId)}:${encodeURIComponent(routeId)}`
}

function memoizePromise<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined
  return () => {
    promise ??= Promise.resolve().then(load)
    return promise
  }
}

function formatRuntimeLoadError(
  code: VoyantGraphRuntimeLoadErrorCode,
  context: VoyantGraphRuntimeLoadErrorContext,
  detail: string,
): string {
  const selectedExport = context.exportName ? ` export "${context.exportName}"` : ""
  const location = context.unitId
    ? ` for ${context.unitId}${context.facet ? ` ${context.facet}` : ""}${context.entityId ? ` ${context.entityId}` : ""}`
    : ""
  const entry = context.entry ? ` from "${context.entry}"` : ""
  return `${code}: failed to load${selectedExport}${entry}${location} (reference ${context.referenceId}): ${detail}.`
}

function isRuntimeExport(value: unknown): boolean {
  return (value !== null && typeof value === "object") || typeof value === "function"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
