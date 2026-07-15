import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const serverPath = "starters/operator/src/server.ts"
const runtimePath = "packages/runtime/src/index.ts"
const violations = []

for (const retired of [
  "starters/operator/src/entry.ts",
  "starters/operator/src/api-dispatch.ts",
  "starters/operator/src/scheduled-crons.ts",
  "starters/operator/src/ssr-handler.ts",
  "starters/operator/src/workflow-runtime.ts",
]) {
  if (existsSync(join(root, retired))) violations.push(`${retired} must stay package-owned`)
}

const server = read(serverPath)
if (!server.includes('from "@voyant-travel/runtime"')) {
  violations.push(`${serverPath} must delegate to @voyant-travel/runtime`)
}
if (!server.includes("createVoyantProjectServerEntry")) {
  violations.push(`${serverPath} must create the generic project server entry`)
}
if (server.split("\n").length > 16) violations.push(`${serverPath} exceeds 16 lines`)

const runtime = read(runtimePath)
for (const required of [
  "createNodeServer",
  "loadGeneratedProjectRuntime",
  "readGeneratedDeploymentGraph",
  "resolveAdminAssetsDir",
  "dispatchScheduledProjectJob",
  "createAdminSsrHandler",
]) {
  if (!runtime.includes(required)) violations.push(`${runtimePath} must contain ${required}`)
}

if (violations.length) {
  console.error(`Node entrypoint check failed:\n- ${violations.join("\n- ")}`)
  process.exit(1)
}

console.log("check-node-entrypoint: OK (generic package-owned Node host)")

function read(file) {
  return readFileSync(join(root, file), "utf8")
}
