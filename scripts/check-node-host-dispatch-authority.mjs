import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const violations = []
const adapters = new Map([
  ["starters/operator/src/workflow-runtime.ts", 45],
  ["starters/operator/src/scheduled-crons.ts", 35],
  ["starters/operator/src/hono-api-dispatch.ts", 35],
])

for (const [file, budget] of adapters) {
  const source = read(file)
  const lines = source.split("\n").length
  if (lines > budget)
    violations.push(`${file}: ${lines} lines exceeds ${budget}-line adapter budget`)
  requireText(source, 'from "@voyant-travel/framework/node-host"', file)
}

for (const file of [
  "starters/operator/src/workflow-runtime.test.ts",
  "starters/operator/src/scheduled-crons.test.ts",
  "starters/operator/src/hono-api-dispatch.test.ts",
]) {
  if (existsSync(resolve(root, file)))
    violations.push(`${file}: generic tests must be framework-owned`)
}

const forbiddenStarterAuthority = [
  "isGraphRuntimeFactory",
  "createApiDispatch",
  "requestBodyLimit",
  "resolveCronJobFromJobs",
  "requireEventFilterManifest",
]
for (const file of adapters.keys()) {
  const source = read(file)
  for (const token of forbiddenStarterAuthority) requireAbsent(source, token, file)
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

console.log("check-node-host-dispatch-authority: OK (three deployment-only adapters)")

function read(file) {
  return readFileSync(resolve(root, file), "utf8")
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) violations.push(`${label}: missing ${expected}`)
}

function requireAbsent(source, forbidden, label) {
  if (source.includes(forbidden)) violations.push(`${label}: contains ${forbidden}`)
}
