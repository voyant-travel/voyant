import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantGraphRuntimePorts } from "@voyant-travel/framework"
import type { OutboundWebhookDeliveryEnqueuer } from "@voyant-travel/webhook-delivery"

export interface CreateVoyantDeploymentResourcesOptions {
  primitives: VoyantRuntimeHostPrimitives
  createRuntimePorts(host: { primitives: VoyantRuntimeHostPrimitives }): VoyantGraphRuntimePorts
  outboundWebhooks?: OutboundWebhookDeliveryEnqueuer
}

export interface VoyantDeploymentResources {
  capabilities: Readonly<Record<string, never>>
  primitives: VoyantRuntimeHostPrimitives
  ports: VoyantGraphRuntimePorts
  outboundWebhooks?: OutboundWebhookDeliveryEnqueuer
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
    ...(options.outboundWebhooks ? { outboundWebhooks: options.outboundWebhooks } : {}),
  }
}
