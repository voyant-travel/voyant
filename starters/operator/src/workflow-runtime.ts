import {
  loadVoyantNodeWorkflowRuntime,
  type VoyantNodeWorkflowRuntime,
} from "@voyant-travel/framework/node-host"
import type { ServiceResolver } from "@voyant-travel/workflows/driver"

import { createGeneratedWorkflowRuntime } from "../.voyant/runtime/project-package-workflows.generated.js"
import { createOperatorWorkflowServiceResolver } from "./api/runtime/operator-workflow-services.js"

export type OperatorWorkflowRuntime = VoyantNodeWorkflowRuntime

export interface OperatorWorkflowRuntimeBootstrapContext {
  env?: AppBindings | NodeJS.ProcessEnv
  services?: ServiceResolver
}

/** Load only graph-selected workflow/event-filter facets for the Node workflow runtime. */
export async function loadOperatorWorkflowRuntime(
  env: AppBindings | NodeJS.ProcessEnv = process.env,
): Promise<OperatorWorkflowRuntime> {
  return loadVoyantNodeWorkflowRuntime({
    graphRuntime: createGeneratedWorkflowRuntime(),
    environment: env,
    createServices: createOperatorWorkflowServiceResolver,
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
