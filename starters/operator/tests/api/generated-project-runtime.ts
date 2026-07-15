import type { VoyantGraphRuntime } from "@voyant-travel/framework"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
} from "@voyant-travel/framework/node-runtime"
import {
  type CreateVoyantDeploymentResourcesOptions,
  createVoyantDeploymentResources,
  resolveSelectedGraphProviderPorts,
} from "@voyant-travel/runtime/deployment-resources"

interface GeneratedProjectRuntimeModule {
  createGeneratedGraphRuntime(): VoyantGraphRuntime
  createGeneratedGraphRuntimePorts: CreateVoyantDeploymentResourcesOptions["createRuntimePorts"]
  GENERATED_GRAPH_RUNTIME_EXTENSION_IDS: readonly string[]
  GENERATED_GRAPH_RUNTIME_MODULE_IDS: readonly string[]
  GENERATED_GRAPH_RUNTIME_PLUGIN_IDS: readonly string[]
}

// Generated wiring is executed by integration tests but checked at its framework source boundary.
const generatedRuntimeSpecifier = "../../.voyant/runtime/project-runtime.generated.ts"
const generatedRuntime = (await import(generatedRuntimeSpecifier)) as GeneratedProjectRuntimeModule

export const {
  createGeneratedGraphRuntime,
  createGeneratedGraphRuntimePorts,
  GENERATED_GRAPH_RUNTIME_EXTENSION_IDS,
  GENERATED_GRAPH_RUNTIME_MODULE_IDS,
  GENERATED_GRAPH_RUNTIME_PLUGIN_IDS,
} = generatedRuntime

const TEST_DEPLOYMENT_VALUES = { DATABASE_URL: "postgres://test" }

export function createGeneratedStaticTestDeploymentResources(
  providerPorts: Parameters<typeof createVoyantDeploymentResources>[0]["providerPorts"] = {},
) {
  const env = createVoyantNodeEnv(TEST_DEPLOYMENT_VALUES)
  const primitives = createVoyantNodeRuntimeHostPrimitives({
    env,
    deliverEvent: async () => undefined,
  })
  return createVoyantDeploymentResources({
    primitives,
    providerPorts,
    createRuntimePorts: createGeneratedGraphRuntimePorts,
  })
}

export async function createGeneratedTestDeploymentResources(
  runtime = createGeneratedGraphRuntime(),
) {
  const providerPorts = await resolveSelectedGraphProviderPorts(runtime, TEST_DEPLOYMENT_VALUES)
  return createGeneratedStaticTestDeploymentResources(providerPorts)
}
