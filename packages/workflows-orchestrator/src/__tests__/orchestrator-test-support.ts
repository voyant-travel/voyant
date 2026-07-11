import { __resetRegistry, getWorkflow } from "@voyant-travel/workflows"
import {
  handleStepRequest,
  type WorkflowResolver,
  type WorkflowStepRequest,
} from "@voyant-travel/workflows/handler"
import { beforeEach } from "vitest"
import type { StepHandler } from "../index.js"

export const workflowResolver: WorkflowResolver = {
  resolve: (workflowId) => getWorkflow(workflowId),
}

export const handler: StepHandler = async (req: WorkflowStepRequest, opts) => {
  return await handleStepRequest(req, { workflowResolver }, opts)
}

export const tenantMeta = {
  tenantId: "tnt_test",
  projectId: "prj_test",
  organizationId: "org_test",
}

beforeEach(() => {
  __resetRegistry()
})
