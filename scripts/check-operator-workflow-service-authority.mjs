import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"

const workflowServicesPath = "starters/operator/src/api/runtime/operator-workflow-services.ts"
const workflowRuntimePath = "packages/runtime/src/index.ts"
const workflowRuntime = await readFile(workflowRuntimePath, "utf8")
const packageBootstrapAssertions = [
  ["packages/catalog/src/runtime-contributor.ts", "CATALOG_DRAFT_REAPER_RUNTIME_KEY"],
  ["packages/cruises/src/runtime-contributor.ts", "CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY"],
  ["packages/db/src/runtime-contributor.ts", "EVENT_OUTBOX_WORKFLOW_RUNTIME_KEY"],
  ["packages/notifications/src/index.ts", "NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY"],
]
if (existsSync(workflowServicesPath)) {
  throw new Error(`${workflowServicesPath} must stay deleted.`)
}
if (/^import\s+.*createGeneratedWorkflowRuntime/m.test(workflowRuntime)) {
  throw new Error(`${workflowRuntimePath} must keep the application graph behind a lazy import.`)
}
for (const required of [
  "generated.createGeneratedWorkflowRuntime()",
  "runtimePorts,",
  "services: runtime.app.services",
]) {
  if (!workflowRuntime.includes(required)) {
    throw new Error(`${workflowRuntimePath} must contain ${JSON.stringify(required)}.`)
  }
}

for (const [path, required] of packageBootstrapAssertions) {
  const source = await readFile(path, "utf8")
  if (!source.includes(required)) {
    throw new Error(`${path} must contain ${JSON.stringify(required)}.`)
  }
}

console.info("Operator workflow service authority: graph-selected package contributors.")
