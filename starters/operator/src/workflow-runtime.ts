import {
  loadVoyantNodeWorkflowRuntime,
  type VoyantNodeWorkflowRuntime,
} from "@voyant-travel/framework/node-host"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
} from "@voyant-travel/framework/node-runtime"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"
import { createGeneratedWorkflowRuntime } from "../.voyant/runtime/project-package-workflows.generated.js"
import { reportBackgroundFailure } from "./lib/observability.js"

export type OperatorWorkflowRuntime = VoyantNodeWorkflowRuntime

export interface OperatorWorkflowRuntimeBootstrapContext {
  env?: AppBindings | NodeJS.ProcessEnv
  services?: ServiceResolver
}

/** Load only graph-selected workflow/event-filter facets for the Node workflow runtime. */
export async function loadOperatorWorkflowRuntime(
  env: AppBindings | NodeJS.ProcessEnv = process.env,
): Promise<OperatorWorkflowRuntime> {
  const environment = createVoyantNodeEnv(env)
  const { createGeneratedProjectRuntime } = await import(
    "../.voyant/runtime/project-runtime.generated.js"
  )
  const generatedProject = createGeneratedProjectRuntime()
  const primitives = createVoyantNodeRuntimeHostPrimitives({ env: environment })
  return loadVoyantNodeWorkflowRuntime({
    graphRuntime: createGeneratedWorkflowRuntime(),
    environment,
    runtimePorts: generatedProject.createRuntimePorts({ primitives }),
    createServices: async (bindings) => {
      const { app } = await import("./api/app.js")
      await app.ready(bindings)
      return {
        services: app.services,
        eventBus: app.eventBus,
        reportFailure: (error: unknown, context: Readonly<Record<string, unknown>>) =>
          reportBackgroundFailure("workflow-service", error, context),
      }
    },
  })
}

/** Compatibility export consumed by workflow bundle hosts. */
export function bootstrapWorkflowBundle(
  ctx: OperatorWorkflowRuntimeBootstrapContext = {},
): Promise<OperatorWorkflowRuntime> {
  return loadOperatorWorkflowRuntime(ctx.env).then((runtime) =>
    ctx.services ? { ...runtime, services: ctx.services } : runtime,
  )
}
