import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantGraphRuntimePorts } from "@voyant-travel/framework"

export interface CreateVoyantDeploymentResourcesOptions {
  primitives: VoyantRuntimeHostPrimitives
  createRuntimePorts(host: { primitives: VoyantRuntimeHostPrimitives }): VoyantGraphRuntimePorts
}

export interface VoyantDeploymentResources {
  capabilities: Readonly<Record<string, never>>
  primitives: VoyantRuntimeHostPrimitives
  ports: VoyantGraphRuntimePorts
  outboundWebhooks: {
    enqueue(event: unknown, bindings: unknown): Promise<unknown>
  }
}

/** Build the domain-neutral resources consumed by a statically generated Voyant graph. */
export function createVoyantDeploymentResources(
  options: CreateVoyantDeploymentResourcesOptions,
): VoyantDeploymentResources {
  const { primitives } = options
  return {
    capabilities: {},
    primitives,
    ports: options.createRuntimePorts({ primitives }),
    outboundWebhooks: {
      enqueue: (event, bindings) => primitives.events.deliver(event, bindings),
    },
  }
}
