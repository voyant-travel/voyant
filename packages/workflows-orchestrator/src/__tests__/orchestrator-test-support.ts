import { __resetRegistry } from "@voyant-travel/workflows"
import { handleStepRequest, type WorkflowStepRequest } from "@voyant-travel/workflows/handler"
import { beforeEach } from "vitest"
import type { StepHandler } from "../index.js"

export const handler: StepHandler = async (req: WorkflowStepRequest, opts) => {
  return await handleStepRequest(req, {}, opts)
}

export const tenantMeta = {
  tenantId: "tnt_test",
  projectId: "prj_test",
  organizationId: "org_test",
}

beforeEach(() => {
  __resetRegistry()
})
