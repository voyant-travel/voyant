import type { VoyantGraphRouteBundle, VoyantGraphUnitKind } from "@voyant-travel/core/project"

export const VOYANT_GRAPH_RUNTIME_LOAD_ERROR_CODES = {
  VOYANT_GRAPH_RUNTIME_IMPORT_FAILED:
    "A lowered graph runtime package entry could not be imported.",
  VOYANT_GRAPH_RUNTIME_EXPORT_MISSING:
    "A lowered graph runtime package entry does not contain the declared export.",
  VOYANT_GRAPH_RUNTIME_EXPORT_INVALID:
    "A lowered graph runtime package export is not a runtime object or factory.",
} as const

export type VoyantGraphRuntimeLoadErrorCode = keyof typeof VOYANT_GRAPH_RUNTIME_LOAD_ERROR_CODES

export interface VoyantGraphRuntimeLoadErrorContext {
  unitId: string
  routeId: string
  entry: string
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
}

export interface VoyantGraphRuntimeUnitDefinition {
  id: string
  kind: VoyantGraphUnitKind
  packageName: string
  order: number
  routes: readonly VoyantGraphRuntimeRouteDefinition[]
}

export interface VoyantGraphRuntimeRouteLoader extends VoyantGraphRuntimeRouteDefinition {
  load: () => Promise<unknown>
}

export interface VoyantGraphRuntimeUnitLoader
  extends Omit<VoyantGraphRuntimeUnitDefinition, "routes"> {
  routes: readonly VoyantGraphRuntimeRouteLoader[]
  /** Load each distinct package entry/export reference in this unit once. */
  load: () => Promise<readonly unknown[]>
}

export interface VoyantGraphRuntime {
  graphHash: string
  modules: readonly VoyantGraphRuntimeUnitLoader[]
  plugins: readonly VoyantGraphRuntimeUnitLoader[]
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
  const usedEntries = validateRuntimeDefinition(input)
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

  return {
    graphHash: input.graphHash,
    modules: input.modules.map((unit) => createRuntimeUnitLoader(unit, importEntries)),
    plugins: input.plugins.map((unit) => createRuntimeUnitLoader(unit, importEntries)),
  }
}

function createRuntimeUnitLoader(
  unit: VoyantGraphRuntimeUnitDefinition,
  entries: ReadonlyMap<string, () => Promise<unknown>>,
): VoyantGraphRuntimeUnitLoader {
  const routes = unit.routes.map((definition) => {
    const importEntry = entries.get(definition.importEntry)
    if (!importEntry) {
      throw new Error(
        `createVoyantGraphRuntime: runtime entry "${definition.importEntry}" for route "${definition.route.id}" is not registered.`,
      )
    }
    return {
      ...definition,
      load: memoizePromise(() => loadRuntimeRouteExport(unit, definition, importEntry)),
    }
  })

  return {
    id: unit.id,
    kind: unit.kind,
    packageName: unit.packageName,
    order: unit.order,
    routes,
    load: memoizePromise(() =>
      Promise.all(uniqueRuntimeRouteLoaders(routes).map((route) => route.load())),
    ),
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

async function loadRuntimeRouteExport(
  unit: VoyantGraphRuntimeUnitDefinition,
  definition: VoyantGraphRuntimeRouteDefinition,
  importEntry: () => Promise<unknown>,
): Promise<unknown> {
  const runtime = definition.route.runtime
  if (!runtime) {
    throw new Error(
      `createVoyantGraphRuntime: route "${definition.route.id}" does not declare a runtime reference.`,
    )
  }
  const context: VoyantGraphRuntimeLoadErrorContext = {
    unitId: unit.id,
    routeId: definition.route.id,
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

function validateRuntimeDefinition(input: CreateVoyantGraphRuntimeInput): string[] {
  if (!input.graphHash.trim()) {
    throw new Error("createVoyantGraphRuntime: graphHash must be a non-empty string.")
  }

  const usedEntries = new Set<string>()
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
      for (const definition of unit.routes) {
        if (!definition.route.runtime) {
          throw new Error(
            `createVoyantGraphRuntime: route "${definition.route.id}" does not declare a runtime reference.`,
          )
        }
        usedEntries.add(definition.importEntry)
      }
    }
  }
  return [...usedEntries].sort((left, right) => left.localeCompare(right))
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
  return `${code}: failed to load${selectedExport} from "${context.entry}" for ${context.unitId} route ${context.routeId}: ${detail}.`
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
