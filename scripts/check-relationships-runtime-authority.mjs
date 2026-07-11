import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const pathOption = (name, fallback) => {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a path`)
  return value
}
const operatorRoot = pathOption("--operator-root", join(ROOT, "starters/operator"))
const relationshipsRoot = pathOption("--relationships-root", join(ROOT, "packages/relationships"))
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-relationships-runtime-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`check-relationships-runtime-authority: could not locate ${start}`)
  }
  return source.slice(startIndex, endIndex)
}

const manifest = readRequired(join(relationshipsRoot, "src/voyant.ts"))
const packageIndex = readRequired(join(relationshipsRoot, "src/index.ts"))
const runtimePort = readRequired(join(relationshipsRoot, "src/runtime-port.ts"))
const composition = readRequired(join(operatorRoot, "src/api/composition.ts"))
const runtimePorts = section(
  composition,
  "export function buildOperatorRuntimePorts",
  "function createLazyCatalogSearchRuntime",
)
const runtimeBindings = section(
  composition,
  "export const operatorGraphRuntimeBindings",
  "function bindingsFromModuleFactories",
)

if (
  !manifest.includes("runtimePorts: [requirePort(relationshipsRouteRuntimePort)]") ||
  !manifest.includes('export: "createRelationshipsVoyantRuntime"') ||
  !manifest.includes('export { relationshipsRouteRuntimePort } from "./runtime-port.js"')
) {
  violations.push("Relationships manifest must own and publish its route runtime dependency")
}
if (
  !runtimePort.includes("definePort<RelationshipsRouteRuntimeOptions>") ||
  !runtimePort.includes('id: "relationships.route-runtime"')
) {
  violations.push("Relationships must define the relationships.route-runtime typed port")
}
if (
  !packageIndex.includes("createRelationshipsVoyantRuntime = defineGraphRuntimeFactory") ||
  !packageIndex.includes("getPort(relationshipsRouteRuntimePort)")
) {
  violations.push("Relationships must adapt its graph runtime factory through its typed port")
}
if (packageIndex.includes("relationshipsHonoModule")) {
  violations.push("Relationships must not retain the preconfigured compatibility module export")
}
if (
  !composition.includes('from "@voyant-travel/relationships/voyant"') ||
  !runtimePorts.includes("[relationshipsRouteRuntimePort.id]")
) {
  violations.push("Operator must bind the generic Relationships runtime port")
}
if (runtimeBindings.includes('"@voyant-travel/relationships"')) {
  violations.push("Operator must not bind Relationships runtime behavior by package id")
}

if (violations.length > 0) {
  console.error("Relationships runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-relationships-runtime-authority: OK (package factory authority; generic Node port binding only)",
)
