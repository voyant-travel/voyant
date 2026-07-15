import {
  packageNameFromSpecifier,
  type ResolvedVoyantDeploymentGraph,
  type ResolvedVoyantGraphUnit,
} from "./deployment-graph.js"
import type {
  VoyantGraphRuntimeActionDefinition,
  VoyantGraphRuntimeConfigDefinition,
  VoyantGraphRuntimeProviderDefinition,
  VoyantGraphRuntimeReferenceDefinition,
  VoyantGraphRuntimeReferenceFacet,
  VoyantGraphRuntimeResourceDefinition,
  VoyantGraphRuntimeSecretDefinition,
  VoyantGraphRuntimeToolDefinition,
  VoyantGraphRuntimeWorkflowDefinition,
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
  manyRuntimePorts: string[]
  requiredRuntimePorts: string[]
  accessScopes: string[]
  tools: VoyantGraphRuntimeToolDefinition[]
  workflows: VoyantGraphRuntimeWorkflowDefinition[]
  actions: VoyantGraphRuntimeActionDefinition[]
  setupSteps: { id: string; skippable: boolean }[]
  selectedIds: {
    routes: string[]
    tools: string[]
    workflows: string[]
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
  return units
    .map((unit) => {
      const references = collectRuntimeReferences(unit, graph, runtimeEntryOverrides)
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
      const workflows = unit.workflows
        .filter((workflow) => workflow.runtime !== undefined)
        .map((workflow) => ({
          unitId: unit.id,
          declaration: workflow,
          referenceId: runtimeReferenceId(unit.id, "workflows.runtime", workflow.id),
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
            workflows: sortedUnique(action.from?.workflows ?? []),
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
        workflows,
        actions,
        setupSteps: (unit.admin?.setupSteps ?? []).map(({ id, skippable }) => ({
          id,
          skippable,
        })),
        selectedIds: {
          routes: unit.api.map(({ id }) => id).sort(),
          tools: (unit.tools ?? []).map(({ id }) => id).sort(),
          workflows: unit.workflows.map(({ id }) => id).sort(),
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
  for (const tool of unit.tools ?? []) add("tools.runtime", tool.id, tool.runtime)
  for (const workflow of unit.workflows) {
    if (workflow.runtime) add("workflows.runtime", workflow.id, workflow.runtime)
  }
  for (const subscriber of unit.subscribers) {
    if (subscriber.runtime) add("subscribers.runtime", subscriber.id, subscriber.runtime)
  }

  return references.sort(
    (left, right) =>
      left.facet.localeCompare(right.facet) || left.entityId.localeCompare(right.entityId),
  )
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
