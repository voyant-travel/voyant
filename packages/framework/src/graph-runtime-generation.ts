import {
  packageNameFromSpecifier,
  type ResolvedVoyantDeploymentGraph,
  type ResolvedVoyantGraphActionDeclaration,
  type ResolvedVoyantGraphUnit,
} from "./deployment-graph.js"
import type {
  VoyantGraphRuntimeActionDefinition,
  VoyantGraphRuntimeConfigDefinition,
  VoyantGraphRuntimeJobDefinition,
  VoyantGraphRuntimePortConformanceDefinition,
  VoyantGraphRuntimeProviderDefinition,
  VoyantGraphRuntimeReferenceDefinition,
  VoyantGraphRuntimeReferenceFacet,
  VoyantGraphRuntimeResourceDefinition,
  VoyantGraphRuntimeSecretDefinition,
  VoyantGraphRuntimeToolDefinition,
} from "./runtime-lowering.js"

interface GeneratedRuntimeRouteDefinition {
  route: ResolvedVoyantGraphUnit["api"][number]
  importEntry: string
  referenceId: string
}

export interface GeneratedRuntimeUnitDefinition {
  id: string
  localId?: string
  kind: ResolvedVoyantGraphUnit["kind"]
  packageName: string
  order: number
  projectConfig?: ResolvedVoyantGraphUnit["projectConfig"]
  runtimeReferenceId?: string
  references: VoyantGraphRuntimeReferenceDefinition[]
  config: VoyantGraphRuntimeConfigDefinition[]
  secrets: VoyantGraphRuntimeSecretDefinition[]
  resources: VoyantGraphRuntimeResourceDefinition[]
  providers: VoyantGraphRuntimeProviderDefinition[]
  requiredPorts: string[]
  runtimePorts: string[]
  runtimePortConformance: VoyantGraphRuntimePortConformanceDefinition[]
  customFieldTargets: ResolvedVoyantGraphUnit["customFieldTargets"]
  manyRuntimePorts: string[]
  requiredRuntimePorts: string[]
  accessScopes: string[]
  tools: VoyantGraphRuntimeToolDefinition[]
  /** Selected conditional Tools retained only for framework-owned post-preflight activation. */
  provisionalTools: VoyantGraphRuntimeToolDefinition[]
  /** Tool references retained only for framework-owned post-preflight activation. */
  provisionalReferences: VoyantGraphRuntimeReferenceDefinition[]
  jobs: VoyantGraphRuntimeJobDefinition[]
  actions: VoyantGraphRuntimeActionDefinition[]
  setupSteps: { id: string; skippable: boolean }[]
  selectedIds: {
    routes: string[]
    tools: string[]
    events: string[]
    webhooks: string[]
  }
  routes: GeneratedRuntimeRouteDefinition[]
}

export function lowerGraphRuntimeUnits(
  units: readonly ResolvedVoyantGraphUnit[],
  graph: ResolvedVoyantDeploymentGraph,
  runtimeEntryOverrides: Readonly<Record<string, string>> | undefined,
): GeneratedRuntimeUnitDefinition[] {
  const { unavailableToolIds, provisionalToolIds, availableToolIds } =
    classifyActionToolPostures(graph)
  const conflictingToolId = [...unavailableToolIds, ...provisionalToolIds].find(
    (id) => availableToolIds.has(id) || (unavailableToolIds.has(id) && provisionalToolIds.has(id)),
  )
  if (conflictingToolId) {
    throw new Error(
      `VOYANT_GRAPH_UNAVAILABLE_TOOL_SHARED: action Tool "${conflictingToolId}" is bound by both available and unavailable actions.`,
    )
  }

  return units
    .map((unit) => {
      const references = collectRuntimeReferences(
        unit,
        graph,
        runtimeEntryOverrides,
        unavailableToolIds,
        provisionalToolIds,
      )
      const provisionalReferences = collectProvisionalToolReferences(
        unit,
        graph,
        runtimeEntryOverrides,
        provisionalToolIds,
      )
      const config = (unit.config ?? []).map((declaration) => ({
        unitId: unit.id,
        declaration,
        ...(declaration.validator
          ? {
              validatorReferenceId: runtimeReferenceId(unit.id, "config.validator", declaration.id),
            }
          : {}),
      }))
      const secrets = (unit.secrets ?? []).map((declaration) => ({
        unitId: unit.id,
        declaration,
        ...(declaration.validator
          ? {
              validatorReferenceId: runtimeReferenceId(
                unit.id,
                "secrets.validator",
                declaration.id,
              ),
            }
          : {}),
      }))
      const resources = (unit.resources ?? []).map((declaration) => ({
        unitId: unit.id,
        declaration,
      }))
      const providers = (unit.providers ?? []).map((declaration) => ({
        unitId: unit.id,
        declaration,
        referenceId: runtimeReferenceId(unit.id, "providers.runtime", declaration.id),
      }))
      const routes = unit.api
        .filter((route) => route.runtime !== undefined)
        .map((route) => {
          const referenceId = runtimeReferenceId(unit.id, "api", route.id)
          const loweredEntry = lowerRuntimeImportEntry(unit, route.runtime!.entry)
          return {
            route,
            importEntry: runtimeEntryOverrides?.[loweredEntry] ?? loweredEntry,
            referenceId,
          }
        })
        .sort((left, right) => left.route.id.localeCompare(right.route.id))
      const accessScopes = [
        ...new Set(
          (unit.access?.resources ?? []).flatMap((resource) =>
            resource.actions.map(
              (action) =>
                `${resource.resource}:${typeof action === "string" ? action : action.action}`,
            ),
          ),
        ),
      ].sort((left, right) => left.localeCompare(right))
      const tools = (unit.tools ?? [])
        .filter((tool) => !unavailableToolIds.has(tool.id) && !provisionalToolIds.has(tool.id))
        .map((tool) => ({
          id: tool.id,
          unitId: unit.id,
          name: tool.name,
          referenceId: runtimeReferenceId(unit.id, "tools.runtime", tool.id),
          requiredScopes: [...(tool.requiredScopes ?? [])].sort((left, right) =>
            left.localeCompare(right),
          ),
          ...(tool.context?.length ? { context: [...tool.context].sort() } : {}),
          ...(tool.risk ? { risk: tool.risk } : {}),
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
      const provisionalTools = (unit.tools ?? [])
        .filter((tool) => provisionalToolIds.has(tool.id))
        .map((tool) => ({
          id: tool.id,
          unitId: unit.id,
          name: tool.name,
          referenceId: runtimeReferenceId(unit.id, "tools.runtime", tool.id),
          requiredScopes: [...(tool.requiredScopes ?? [])].sort((left, right) =>
            left.localeCompare(right),
          ),
          ...(tool.context?.length ? { context: [...tool.context].sort() } : {}),
          ...(tool.risk ? { risk: tool.risk } : {}),
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
      const jobs = (unit.jobs ?? [])
        .map((job) => ({
          unitId: unit.id,
          declaration: job,
          referenceId: runtimeReferenceId(unit.id, "jobs.runtime", job.id),
        }))
        .sort((left, right) => left.declaration.id.localeCompare(right.declaration.id))
      const actions = (unit.actions ?? [])
        .map((action) => ({
          ...action,
          unitId: unit.id,
          requiredScopes: sortedUnique(action.requiredScopes ?? []),
          from: {
            routes: sortedUnique(action.from?.routes ?? []),
            tools: sortedUnique(action.from?.tools ?? []),
            events: sortedUnique(action.from?.events ?? []),
            webhooks: sortedUnique(action.from?.webhooks ?? []),
          },
          ...(action.copy ? { copy: [...action.copy].sort(compareCopyReferences) } : {}),
        }))
        .sort(
          (left, right) =>
            left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
        )

      return {
        id: unit.id,
        ...(unit.localId ? { localId: unit.localId } : {}),
        kind: unit.kind,
        packageName: unit.packageName,
        order: unit.order,
        ...(unit.projectConfig ? { projectConfig: unit.projectConfig } : {}),
        ...(unit.runtime
          ? { runtimeReferenceId: runtimeReferenceId(unit.id, "runtime", unit.id) }
          : {}),
        references,
        config,
        secrets,
        resources,
        providers,
        requiredPorts: unit.requires.ports
          .filter((port) => !port.optional)
          .map((port) => port.id)
          .sort(),
        runtimePorts: (unit.runtimePorts ?? []).map((port) => port.id).sort(),
        runtimePortConformance: (unit.runtimePorts ?? [])
          .filter((port) => port.conformance !== undefined)
          .map((port) => ({
            portId: port.id,
            referenceId: runtimeReferenceId(unit.id, "runtimePorts.conformance", port.id),
          }))
          .sort((left, right) => left.portId.localeCompare(right.portId)),
        customFieldTargets: unit.customFieldTargets,
        manyRuntimePorts: (unit.runtimePorts ?? [])
          .filter((port) => port.cardinality === "many")
          .map((port) => port.id)
          .sort(),
        requiredRuntimePorts: (unit.runtimePorts ?? [])
          .filter((port) => !port.optional)
          .map((port) => port.id)
          .sort(),
        accessScopes,
        tools,
        provisionalTools,
        provisionalReferences,
        jobs,
        actions,
        setupSteps: (unit.admin?.setupSteps ?? []).map(({ id, skippable }) => ({
          id,
          skippable,
        })),
        selectedIds: {
          routes: unit.api.map(({ id }) => id).sort(),
          tools: (unit.tools ?? [])
            .filter(({ id }) => !unavailableToolIds.has(id) && !provisionalToolIds.has(id))
            .map(({ id }) => id)
            .sort(),
          events: unit.events.map(({ id }) => id).sort(),
          webhooks: (unit.webhooks ?? []).map(({ id }) => id).sort(),
        },
        routes,
      }
    })
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function compareCopyReferences(
  left: { namespace: string; key: string },
  right: { namespace: string; key: string },
): number {
  return left.namespace.localeCompare(right.namespace) || left.key.localeCompare(right.key)
}

function collectRuntimeReferences(
  unit: ResolvedVoyantGraphUnit,
  graph: ResolvedVoyantDeploymentGraph,
  runtimeEntryOverrides: Readonly<Record<string, string>> | undefined,
  unavailableToolIds: ReadonlySet<string>,
  provisionalToolIds: ReadonlySet<string>,
): VoyantGraphRuntimeReferenceDefinition[] {
  const admittedPackages = new Set(graph.packageRecords.map((record) => record.packageName))
  const references: VoyantGraphRuntimeReferenceDefinition[] = []

  const add = (
    facet: VoyantGraphRuntimeReferenceFacet,
    entityId: string,
    runtime: { entry: string; export?: string },
  ) => {
    const referencedPackage = runtime.entry.startsWith(".")
      ? unit.packageName
      : packageNameFromSpecifier(runtime.entry)
    if (!admittedPackages.has(referencedPackage)) {
      throw new Error(
        `VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED: buildGraphRuntimeModule: runtime entry "${runtime.entry}" for ${unit.id} ${facet} ${entityId} resolves to package "${referencedPackage}", which is not admitted by the graph.`,
      )
    }
    const loweredEntry = lowerRuntimeImportEntry(unit, runtime.entry)
    references.push({
      id: runtimeReferenceId(unit.id, facet, entityId),
      unitId: unit.id,
      facet,
      entityId,
      runtime,
      importEntry: runtimeEntryOverrides?.[loweredEntry] ?? loweredEntry,
    })
  }

  if (unit.runtime) add("runtime", unit.id, unit.runtime)
  for (const route of unit.api) if (route.runtime) add("api", route.id, route.runtime)
  for (const config of unit.config ?? []) {
    if (config.validator) add("config.validator", config.id, config.validator)
  }
  for (const secret of unit.secrets ?? []) {
    if (secret.validator) add("secrets.validator", secret.id, secret.validator)
  }
  for (const provider of unit.providers ?? [])
    add("providers.runtime", provider.id, provider.runtime)
  for (const copy of unit.admin?.copy ?? []) add("admin.copy.runtime", copy.id, copy.runtime)
  for (const route of unit.admin?.routes ?? []) add("admin.routes.runtime", route.id, route.runtime)
  for (const contribution of unit.admin?.contributions ?? []) {
    add("admin.contributions.runtime", contribution.id, contribution.runtime)
  }
  for (const dataset of unit.reporting?.datasets ?? []) {
    add("reporting.datasets.runtime", dataset.id, dataset.runtime)
  }
  for (const tool of unit.tools ?? []) {
    if (!unavailableToolIds.has(tool.id) && !provisionalToolIds.has(tool.id)) {
      add("tools.runtime", tool.id, tool.runtime)
    }
  }
  for (const port of unit.runtimePorts ?? []) {
    if (port.conformance) add("runtimePorts.conformance", port.id, port.conformance)
  }
  for (const job of unit.jobs ?? []) add("jobs.runtime", job.id, job.runtime)
  for (const subscriber of unit.subscribers) {
    if (subscriber.runtime) add("subscribers.runtime", subscriber.id, subscriber.runtime)
  }

  return references.sort(
    (left, right) =>
      left.facet.localeCompare(right.facet) || left.entityId.localeCompare(right.entityId),
  )
}

function collectProvisionalToolReferences(
  unit: ResolvedVoyantGraphUnit,
  graph: ResolvedVoyantDeploymentGraph,
  runtimeEntryOverrides: Readonly<Record<string, string>> | undefined,
  provisionalToolIds: ReadonlySet<string>,
): VoyantGraphRuntimeReferenceDefinition[] {
  const admittedPackages = new Set(graph.packageRecords.map((record) => record.packageName))
  return (unit.tools ?? [])
    .filter((tool) => provisionalToolIds.has(tool.id))
    .map((tool) => {
      const referencedPackage = tool.runtime.entry.startsWith(".")
        ? unit.packageName
        : packageNameFromSpecifier(tool.runtime.entry)
      if (!admittedPackages.has(referencedPackage)) {
        throw new Error(
          `VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED: buildGraphRuntimeModule: runtime entry "${tool.runtime.entry}" for ${unit.id} tools.runtime ${tool.id} resolves to package "${referencedPackage}", which is not admitted by the graph.`,
        )
      }
      const loweredEntry = lowerRuntimeImportEntry(unit, tool.runtime.entry)
      return {
        id: runtimeReferenceId(unit.id, "tools.runtime", tool.id),
        unitId: unit.id,
        facet: "tools.runtime" as const,
        entityId: tool.id,
        runtime: tool.runtime,
        importEntry: runtimeEntryOverrides?.[loweredEntry] ?? loweredEntry,
      }
    })
    .sort((left, right) => left.entityId.localeCompare(right.entityId))
}

function allResolvedGraphUnits(graph: ResolvedVoyantDeploymentGraph): ResolvedVoyantGraphUnit[] {
  return [
    ...graph.modules,
    ...graph.extensions,
    ...graph.plugins,
    ...graph.adapters,
    ...graph.providers,
  ]
}

function classifyActionToolPostures(graph: ResolvedVoyantDeploymentGraph): {
  unavailableToolIds: Set<string>
  provisionalToolIds: Set<string>
  availableToolIds: Set<string>
} {
  const unavailableToolIds = new Set<string>()
  const provisionalToolIds = new Set<string>()
  const availableToolIds = new Set<string>()
  for (const unit of allResolvedGraphUnits(graph)) {
    for (const action of unit.actions ?? []) {
      const target =
        action.availability?.status !== "unavailable"
          ? availableToolIds
          : selectedConditionalAction(action, graph)
            ? provisionalToolIds
            : unavailableToolIds
      for (const toolId of action.from?.tools ?? []) target.add(toolId)
    }
  }
  return { unavailableToolIds, provisionalToolIds, availableToolIds }
}

function selectedConditionalAction(
  action: ResolvedVoyantGraphActionDeclaration,
  graph: ResolvedVoyantDeploymentGraph,
): boolean {
  const availability = action.availability
  const condition = availability?.status === "unavailable" ? availability.enableWhen : undefined
  if (!condition) return false
  const units = allResolvedGraphUnits(graph)
  const selectedCounts = condition.selectedProviderPorts.ports.map(
    (portId) =>
      units.flatMap((unit) =>
        unit.provides.ports.some(({ id }) => id === portId)
          ? (unit.providers ?? []).filter(({ port, selection }) => {
              return (
                port === portId &&
                selection !== undefined &&
                graph.deployment.providers[selection.role] === selection.value
              )
            })
          : [],
      ).length,
  )
  if (selectedCounts.some((count) => count > 1)) return false
  return condition.selectedProviderPorts.mode === "all"
    ? selectedCounts.every((count) => count === 1)
    : selectedCounts.some((count) => count === 1)
}

function runtimeReferenceId(
  unitId: string,
  facet: VoyantGraphRuntimeReferenceFacet,
  entityId: string,
): string {
  return `${encodeURIComponent(unitId)}/${facet}/${encodeURIComponent(entityId)}`
}

function lowerRuntimeImportEntry(unit: ResolvedVoyantGraphUnit, entry: string): string {
  if (!entry.startsWith(".")) return entry
  if (entry === "." || entry === "./") return unit.packageName
  if (!entry.startsWith("./") || entry.includes("\\")) {
    throw new Error(
      `buildGraphRuntimeModule: runtime entry "${entry}" for ${unit.id} must be an owner-relative "./" package export.`,
    )
  }

  const parts = entry.slice(2).split("/")
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new Error(
      `buildGraphRuntimeModule: runtime entry "${entry}" for ${unit.id} contains an invalid package export path.`,
    )
  }
  return `${unit.packageName}/${parts.join("/")}`
}
