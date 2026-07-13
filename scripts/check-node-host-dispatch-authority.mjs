import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const violations = []
const retiredAdapters = [
  "starters/operator/src/workflow-runtime.ts",
  "starters/operator/src/scheduled-crons.ts",
  "starters/operator/src/hono-api-dispatch.ts",
  "starters/operator/src/entry.ts",
  "starters/operator/src/ssr-handler.ts",
]

for (const file of retiredAdapters) {
  if (existsSync(resolve(root, file)))
    violations.push(`${file}: generic host behavior must stay package-owned`)
}

for (const file of [
  "starters/operator/src/workflow-runtime.test.ts",
  "starters/operator/src/scheduled-crons.test.ts",
  "starters/operator/src/hono-api-dispatch.test.ts",
]) {
  if (existsSync(resolve(root, file)))
    violations.push(`${file}: generic tests must be framework-owned`)
}

const runtime = read("packages/operator-runtime/src/index.ts")
for (const token of [
  "loadOperatorProject",
  "dispatchScheduledProjectJob",
  "loadOperatorProjectWorkflowRuntime",
  "createOperatorProjectServerEntry",
]) {
  requireText(runtime, token, "packages/operator-runtime/src/index.ts")
}

for (const file of [
  "packages/framework/src/node-api-dispatch.ts",
  "packages/framework/src/node-scheduled-jobs.ts",
  "packages/framework/src/node-workflow-runtime.ts",
]) {
  const source = read(file)
  requireAbsent(source, "Operator", file)
  requireAbsent(source, "operator", file)
}

if (violations.length > 0) {
  console.error("Node host dispatch authority check failed:")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-node-host-dispatch-authority: OK (starter dispatch adapters deleted)")

function read(file) {
  return readFileSync(resolve(root, file), "utf8")
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) violations.push(`${label}: missing ${expected}`)
}

function requireAbsent(source, forbidden, label) {
  if (source.includes(forbidden)) violations.push(`${label}: contains ${forbidden}`)
}
