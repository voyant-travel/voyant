import { loadVoyantProjectWorkflowRuntime } from "./index.js"

/** Graph-native workflow bundle entry. Project selection is loaded from cwd. */
export async function bootstrapWorkflowBundle() {
  return loadVoyantProjectWorkflowRuntime({ projectRoot: process.cwd() })
}
