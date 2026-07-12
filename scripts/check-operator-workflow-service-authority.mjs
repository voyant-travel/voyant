import { readFile } from "node:fs/promises"

const workflowServicesPath = "starters/operator/src/api/runtime/operator-workflow-services.ts"
const appPath = "packages/hono/src/app.ts"
const workflowServices = await readFile(workflowServicesPath, "utf8")
const app = await readFile(appPath, "utf8")
const packageBootstrapAssertions = [
  ["packages/bookings/src/index.ts", "provider.registerWorkflowService?.(context)"],
  ["packages/inventory/src/graph-runtime.ts", "bootstrap: runtime.bootstrap"],
  [
    "packages/distribution/src/channel-push/extension.ts",
    "await runtime.registerWorkflowService(context)",
  ],
  [
    "packages/notifications/src/index.ts",
    "provider.resolveReminderWorkflowRuntime(context.bindings",
  ],
]
const lineCount = workflowServices.split("\n").length

if (lineCount > 184) {
  throw new Error(`${workflowServicesPath} has ${lineCount} lines; expected at most 184.`)
}

for (const forbidden of ["createContainer", "OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS"]) {
  if (workflowServices.includes(forbidden)) {
    throw new Error(`${workflowServicesPath} must not contain ${JSON.stringify(forbidden)}.`)
  }
}

for (const required of ["await app.ready(appBindings)", "return app.services"]) {
  if (!workflowServices.includes(required)) {
    throw new Error(`${workflowServicesPath} must contain ${JSON.stringify(required)}.`)
  }
}

for (const required of [
  'services: import("@voyant-travel/core").ModuleContainer',
  "augmented.services = container",
]) {
  if (!app.includes(required)) {
    throw new Error(`${appPath} must contain ${JSON.stringify(required)}.`)
  }
}

for (const [path, required] of packageBootstrapAssertions) {
  const source = await readFile(path, "utf8")
  if (!source.includes(required)) {
    throw new Error(`${path} must contain ${JSON.stringify(required)}.`)
  }
}

console.info(`Operator workflow service authority: ${lineCount}/184 starter lines.`)
