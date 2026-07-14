import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  resolveVoyantGraphRuntimeProviders,
  type VoyantGraphRuntime,
  type VoyantGraphRuntimePorts,
} from "@voyant-travel/framework"
import type { OutboundWebhookDeliveryEnqueuer } from "@voyant-travel/webhook-delivery"

export interface CreateVoyantDeploymentResourcesOptions {
  primitives: VoyantRuntimeHostPrimitives
  providerPorts?: VoyantGraphRuntimePorts
  createRuntimePorts(host: {
    primitives: VoyantRuntimeHostPrimitives
    runtimePorts?: VoyantGraphRuntimePorts
  }): VoyantGraphRuntimePorts
  outboundWebhooks?: OutboundWebhookDeliveryEnqueuer
}

export interface VoyantDeploymentResources {
  capabilities: Readonly<Record<string, never>>
  primitives: VoyantRuntimeHostPrimitives
  ports: VoyantGraphRuntimePorts
  outboundWebhooks?: OutboundWebhookDeliveryEnqueuer
}

export interface ResolveSelectedGraphProviderPortsOptions {
  excludedPorts?: readonly string[]
  deploymentValueAliases?: Readonly<Record<string, readonly string[]>>
}

const CATALOG_INDEXER_PORT_ID = "catalog.indexer"

export interface VoyantSearchProviderAuthority {
  deployment: { providers: Readonly<Record<string, unknown>> }
  graphRuntime: { providerSelections?: Readonly<Record<string, unknown>> }
}

/** Admit host runtime-port overrides without bypassing deployment provider selection. */
export function resolveAdmittedHostRuntimePorts(
  runtimePorts: VoyantGraphRuntimePorts,
  authority: VoyantSearchProviderAuthority,
): VoyantGraphRuntimePorts {
  const deploymentSearch = authority.deployment.providers.search
  const graphSearch = authority.graphRuntime.providerSelections?.search
  if (deploymentSearch !== graphSearch) {
    throw new Error(
      `Generated search provider authority mismatch: deployment.providers.search=${JSON.stringify(deploymentSearch)} does not match graphRuntime.providerSelections.search=${JSON.stringify(graphSearch)}.`,
    )
  }
  if (deploymentSearch === "custom" || !(CATALOG_INDEXER_PORT_ID in runtimePorts)) {
    return runtimePorts
  }

  const admitted = { ...runtimePorts }
  delete admitted[CATALOG_INDEXER_PORT_ID]
  return admitted
}

/** Build the domain-neutral resources consumed by a statically generated Voyant graph. */
export function createVoyantDeploymentResources(
  options: CreateVoyantDeploymentResourcesOptions,
): VoyantDeploymentResources {
  const { primitives } = options
  return {
    capabilities: {},
    primitives,
    ports: options.createRuntimePorts({
      primitives,
      ...(options.providerPorts ? { runtimePorts: options.providerPorts } : {}),
    }),
    ...(options.outboundWebhooks ? { outboundWebhooks: options.outboundWebhooks } : {}),
  }
}

/** Resolve deployment-selected graph providers into contributor-visible runtime ports. */
export async function resolveSelectedGraphProviderPorts(
  runtime: VoyantGraphRuntime,
  deploymentValues: Readonly<Record<string, unknown>>,
  options: ResolveSelectedGraphProviderPortsOptions = {},
): Promise<VoyantGraphRuntimePorts> {
  const excluded = new Set(options.excludedPorts ?? [])
  const ports = [
    ...new Set(
      (runtime.providers ?? []).flatMap(({ declaration }) => {
        const selection = declaration.selection
        if (!selection || excluded.has(declaration.port)) return []
        const selectedValue = runtime.providerSelections?.[selection.role]
        if (selectedValue === selection.value) return [declaration.port]
        if (!selectedValue || selectedValue === "none") return []

        const hasSelectedDeclaration = (runtime.providers ?? []).some(
          ({ declaration: candidate }) =>
            !excluded.has(candidate.port) &&
            candidate.selection?.role === selection.role &&
            candidate.selection.value === selectedValue,
        )
        return hasSelectedDeclaration ? [] : [declaration.port]
      }),
    ),
  ].sort()
  if (ports.length === 0) return {}

  const providers = await resolveVoyantGraphRuntimeProviders(runtime, {
    ports,
    deploymentValues,
    ...(options.deploymentValueAliases
      ? { deploymentValueAliases: options.deploymentValueAliases }
      : {}),
  })
  const resolved: Record<string, unknown> = {}
  for (const port of ports) resolved[port] = await providers.getProvider(port)
  return resolved
}
