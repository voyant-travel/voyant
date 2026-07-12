import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const violations = []
const starterAdapterPath = "starters/operator/src/deployment-graph-artifacts.ts"
const starterAdapter = read(starterAdapterPath)
const frameworkFiles = [
  "packages/framework/src/node-deployment-artifacts.ts",
  "packages/framework/src/node-host.ts",
  "packages/framework/src/node-provider-plan.ts",
]

for (const retiredPath of ["starters/operator/src/operator-node-provider-plan.ts"]) {
  if (existsSync(resolve(root, retiredPath))) {
    violations.push(`${retiredPath}: generic Node provider planning must stay framework-owned`)
  }
}

const adapterLines = starterAdapter.split("\n").length
if (adapterLines > 24) {
  violations.push(`${starterAdapterPath}: ${adapterLines} lines exceeds the 24-line adapter budget`)
}
requireText(starterAdapter, 'from "@voyant-travel/framework/node-host"', starterAdapterPath)
for (const forbidden of ["node:crypto", "node:fs", "readFileSync", "createHash"]) {
  requireAbsent(starterAdapter, forbidden, starterAdapterPath)
}

for (const file of frameworkFiles) {
  const source = read(file)
  requireAbsent(source, "Operator", file)
  requireAbsent(source, "operator", file)
  const productPackage = source.match(/@voyant-travel\/(?!framework(?:[/#"]|$))[^\s"']+/)
  if (productPackage)
    violations.push(`${file}: contains product package authority ${productPackage[0]}`)
}

const frameworkPackage = read("packages/framework/package.json")
requireText(frameworkPackage, '"./node-host": "./src/node-host.ts"', "framework package exports")
requireText(frameworkPackage, '"./node-host"', "framework publish exports")

const server = read("starters/operator/src/server.ts")
requireText(server, 'from "@voyant-travel/framework/node-host"', "Operator Node server")
requireText(server, "resolveVoyantNodeProviderPlan", "Operator Node server")

if (violations.length > 0) {
  console.error("Generic Node bootstrap authority check failed:")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(`check-generic-node-bootstrap-authority: OK (${adapterLines}/24 adapter lines)`)

function read(file) {
  return readFileSync(resolve(root, file), "utf8")
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) violations.push(`${label}: missing ${expected}`)
}

function requireAbsent(source, forbidden, label) {
  if (source.includes(forbidden)) violations.push(`${label}: contains ${forbidden}`)
}
