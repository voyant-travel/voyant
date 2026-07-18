import type { VoyantGraphJsonObject } from "@voyant-travel/core/project"

import type {
  VoyantGraphRuntime,
  VoyantGraphRuntimeProviderLoader,
  VoyantGraphRuntimeResourceDefinition,
} from "./runtime-lowering.js"
import {
  type ResolveVoyantGraphRuntimeValuesInput,
  resolveVoyantGraphRuntimeValues,
} from "./runtime-values.js"

export const VOYANT_GRAPH_RUNTIME_PROVIDER_ERROR_CODES = {
  VOYANT_GRAPH_RUNTIME_PROVIDER_MISSING: "A required runtime port has no selected provider.",
  VOYANT_GRAPH_RUNTIME_PROVIDER_AMBIGUOUS: "A runtime port has more than one selected provider.",
  VOYANT_GRAPH_RUNTIME_PROVIDER_UNKNOWN: "A runtime port was not selected.",
  VOYANT_GRAPH_RUNTIME_PROVIDER_FACTORY_INVALID:
    "A selected provider runtime export is not a factory.",
} as const

export type VoyantGraphRuntimeProviderErrorCode =
  keyof typeof VOYANT_GRAPH_RUNTIME_PROVIDER_ERROR_CODES

export interface VoyantGraphRuntimeProviderIssue {
  code: VoyantGraphRuntimeProviderErrorCode
  port: string
  declarationIds: readonly string[]
}

export class VoyantGraphRuntimeProviderError extends Error {
  readonly issues: readonly VoyantGraphRuntimeProviderIssue[]

  constructor(issues: readonly VoyantGraphRuntimeProviderIssue[]) {
    super(
      `Voyant graph runtime providers are not valid:\n${issues
        .map(
          (issue) =>
            `- ${issue.code}: port "${issue.port}" (${issue.declarationIds.join(", ") || "none"})`,
        )
        .join("\n")}`,
    )
    this.name = "VoyantGraphRuntimeProviderError"
    this.issues = issues
  }
}

export interface VoyantGraphProviderFactoryContext {
  unitId: string
  declarationId: string
  port: string
  providerConfig: VoyantGraphJsonObject
  resources: readonly VoyantGraphRuntimeResourceDefinition[]
  getConfig: <T = unknown>(declarationId: string) => T | undefined
  getSecret: <T = unknown>(declarationId: string) => T | undefined
  getResource: <T = unknown>(declarationId: string) => T | undefined
}

export type VoyantGraphProviderFactory<T = unknown> = (
  context: VoyantGraphProviderFactoryContext,
) => T | Promise<T>

export interface ResolveVoyantGraphRuntimeProvidersInput
  extends ResolveVoyantGraphRuntimeValuesInput {
  resourceValues?: Readonly<Record<string, unknown>>
  /** Resolve only these ports and the runtime values owned by their selected providers. */
  ports?: readonly string[]
}

export interface SelectedVoyantGraphRuntimeProvider {
  unitId: string
  declarationId: string
  port: string
  selection: { role: string; value: string }
}

export interface ResolvedVoyantGraphRuntimeProviders {
  graphHash: string
  /** Redacted selection metadata. Provider instances and runtime values are not enumerable. */
  selectedProviders: readonly SelectedVoyantGraphRuntimeProvider[]
  getProvider: <T = unknown>(port: string) => Promise<T>
}

/** Validate explicit selections, then instantiate each selected provider only on first use. */
export async function resolveVoyantGraphRuntimeProviders(
  runtime: VoyantGraphRuntime,
  input: ResolveVoyantGraphRuntimeProvidersInput = {},
): Promise<ResolvedVoyantGraphRuntimeProviders> {
  const requestedPorts = input.ports ? new Set(input.ports) : undefined
  const selected = runtime.providers.filter(({ declaration }) => {
    const match = declaration.selection
    return (
      match !== undefined &&
      runtime.providerSelections[match.role] === match.value &&
      (!requestedPorts || requestedPorts.has(declaration.port))
    )
  })
  for (const provider of selected) assertProviderUses(provider, runtime)
  const values = await resolveVoyantGraphRuntimeValues(
    requestedPorts ? scopeRuntimeToProviders(runtime, selected) : runtime,
    input,
  )
  const byPort = new Map<string, VoyantGraphRuntimeProviderLoader[]>()
  for (const provider of selected) {
    const providers = byPort.get(provider.declaration.port) ?? []
    providers.push(provider)
    byPort.set(provider.declaration.port, providers)
  }

  const issues: VoyantGraphRuntimeProviderIssue[] = []
  const portsToValidate = requestedPorts ?? new Set([...runtime.requiredPorts, ...byPort.keys()])
  for (const port of portsToValidate) {
    const providers = byPort.get(port) ?? []
    if (providers.length === 0 && (requestedPorts || runtime.requiredPorts.includes(port))) {
      issues.push({
        code: "VOYANT_GRAPH_RUNTIME_PROVIDER_MISSING",
        port,
        declarationIds: [],
      })
    } else if (providers.length > 1) {
      issues.push({
        code: "VOYANT_GRAPH_RUNTIME_PROVIDER_AMBIGUOUS",
        port,
        declarationIds: providers.map(({ declaration }) => declaration.id).sort(),
      })
    }
  }
  if (issues.length > 0) throw new VoyantGraphRuntimeProviderError(issues)

  const loads = new Map<string, Promise<unknown>>()
  const resourceValues = input.resourceValues ?? {}
  const selectedProviders = selected.map(({ unitId, declaration }) => {
    const selection = declaration.selection!
    return {
      unitId,
      declarationId: declaration.id,
      port: declaration.port,
      selection: { ...selection },
    }
  })

  return {
    graphHash: runtime.graphHash,
    selectedProviders,
    getProvider: async <T = unknown>(port: string): Promise<T> => {
      const provider = byPort.get(port)?.[0]
      if (!provider) {
        throw new VoyantGraphRuntimeProviderError([
          { code: "VOYANT_GRAPH_RUNTIME_PROVIDER_UNKNOWN", port, declarationIds: [] },
        ])
      }
      let load = loads.get(provider.declaration.id)
      if (!load) {
        load = instantiateProvider(provider, runtime, values, resourceValues)
        loads.set(provider.declaration.id, load)
      }
      return load as Promise<T>
    },
  }
}

function scopeRuntimeToProviders(
  runtime: VoyantGraphRuntime,
  providers: readonly VoyantGraphRuntimeProviderLoader[],
): VoyantGraphRuntime {
  const unitIds = new Set(providers.map(({ unitId }) => unitId))
  const configIds = providerUseIds(providers, "config")
  const secretIds = providerUseIds(providers, "secrets")
  const resourceIds = providerUseIds(providers, "resources")
  const includeUnit = ({ id }: { id: string }) => unitIds.has(id)
  return {
    ...runtime,
    modules: runtime.modules.filter(includeUnit),
    extensions: runtime.extensions.filter(includeUnit),
    plugins: runtime.plugins.filter(includeUnit),
    adapters: (runtime.adapters ?? []).filter(includeUnit),
    providerUnits: (runtime.providerUnits ?? []).filter(includeUnit),
    config: runtime.config.filter(({ declaration }) => configIds.has(declaration.id)),
    secrets: runtime.secrets.filter(({ declaration }) => secretIds.has(declaration.id)),
    resources: runtime.resources.filter(({ declaration }) => resourceIds.has(declaration.id)),
    providers: [...providers],
    requiredPorts: [],
  }
}

function providerUseIds(
  providers: readonly VoyantGraphRuntimeProviderLoader[],
  facet: "config" | "secrets" | "resources",
): Set<string> {
  return new Set(providers.flatMap(({ declaration }) => declaration.uses?.[facet] ?? []))
}

function assertProviderUses(
  provider: VoyantGraphRuntimeProviderLoader,
  runtime: VoyantGraphRuntime,
): void {
  const known = {
    config: runtime.config,
    secrets: runtime.secrets,
    resources: runtime.resources,
  }
  for (const facet of ["config", "secrets", "resources"] as const) {
    for (const id of provider.declaration.uses?.[facet] ?? []) {
      const definition = known[facet].find(({ declaration }) => declaration.id === id)
      if (!definition || definition.unitId !== provider.unitId) {
        throw new Error(
          `Provider "${provider.declaration.id}" declares unowned graph ${facet} declaration "${id}".`,
        )
      }
    }
  }
}

async function instantiateProvider(
  provider: VoyantGraphRuntimeProviderLoader,
  runtime: VoyantGraphRuntime,
  values: Awaited<ReturnType<typeof resolveVoyantGraphRuntimeValues>>,
  resourceValues: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const factory = await provider.load()
  if (typeof factory !== "function") {
    throw new VoyantGraphRuntimeProviderError([
      {
        code: "VOYANT_GRAPH_RUNTIME_PROVIDER_FACTORY_INVALID",
        port: provider.declaration.port,
        declarationIds: [provider.declaration.id],
      },
    ])
  }
  const ownedConfig = new Set(provider.declaration.uses?.config ?? [])
  const ownedSecrets = new Set(provider.declaration.uses?.secrets ?? [])
  const ownedResourceIds = new Set(provider.declaration.uses?.resources ?? [])
  const ownedResources = runtime.resources.filter(({ declaration }) =>
    ownedResourceIds.has(declaration.id),
  )
  const requireOwned = (ids: ReadonlySet<string>, id: string, facet: string) => {
    if (!ids.has(id)) {
      throw new Error(
        `Provider "${provider.declaration.id}" requested unowned graph ${facet} declaration "${id}".`,
      )
    }
  }
  return (factory as VoyantGraphProviderFactory)({
    unitId: provider.unitId,
    declarationId: provider.declaration.id,
    port: provider.declaration.port,
    providerConfig: provider.declaration.config ?? {},
    resources: ownedResources,
    getConfig: <T = unknown>(id: string) => {
      requireOwned(ownedConfig, id, "config")
      return values.getConfig<T>(id)
    },
    getSecret: <T = unknown>(id: string) => {
      requireOwned(ownedSecrets, id, "secret")
      return values.getSecret<T>(id)
    },
    getResource: <T = unknown>(id: string) => {
      requireOwned(ownedResourceIds, id, "resource")
      return resourceValues[id] as T | undefined
    },
  })
}
