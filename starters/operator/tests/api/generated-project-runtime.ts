import type { VoyantGraphRuntime } from "@voyant-travel/framework"
import type { CreateOperatorDeploymentResourcesOptions } from "@voyant-travel/operator-runtime/deployment-resources"

interface GeneratedProjectRuntimeModule {
  createGeneratedGraphRuntime(): VoyantGraphRuntime
  createGeneratedGraphRuntimePorts: CreateOperatorDeploymentResourcesOptions["createRuntimePorts"]
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
