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
const compositionPath = pathOption(
  "--composition",
  join(ROOT, "packages/runtime/src/deployment-resources.ts"),
)
const retiredAdapterPath = pathOption(
  "--retired-adapter",
  join(ROOT, "starters/operator/src/api/runtime/runtime-adapter.ts"),
)
const relationshipsRoot = pathOption("--relationships-root", join(ROOT, "packages/relationships"))
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-relationships-runtime-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

const manifest = readRequired(join(relationshipsRoot, "src/voyant.ts"))
const packageIndex = readRequired(join(relationshipsRoot, "src/index.ts"))
const runtimePort = readRequired(join(relationshipsRoot, "src/runtime-port.ts"))
const runtimeContributor = readRequired(join(relationshipsRoot, "src/runtime-contributor.ts"))
const composition = readRequired(compositionPath)

if (existsSync(retiredAdapterPath)) {
  violations.push("starters/operator/src/api/runtime/runtime-adapter.ts must stay deleted")
}

if (
  !manifest.includes("runtimePorts: [requirePort(relationshipsRouteRuntimePort)]") ||
  !manifest.includes('export: "createRelationshipsVoyantRuntime"') ||
  !manifest.includes("relationshipsMiceRuntimePort")
) {
  violations.push("Relationships manifest must own and publish its route runtime dependency")
}
if (
  !runtimePort.includes("definePort<RelationshipsRouteRuntimeOptions>") ||
  !runtimePort.includes('id: "relationships.route-runtime"') ||
  !runtimePort.includes('id: "relationships.mice.runtime"')
) {
  violations.push("Relationships must define the relationships.route-runtime typed port")
}
if (
  !packageIndex.includes("createRelationshipsVoyantRuntime = defineGraphRuntimeFactory") ||
  !packageIndex.includes("getPort(relationshipsRouteRuntimePort)")
) {
  violations.push("Relationships must adapt its graph runtime factory through its typed port")
}
if (packageIndex.includes("relationshipsApiModule")) {
  violations.push("Relationships must not retain the preconfigured compatibility module export")
}
if (
  runtimeContributor.includes("host.capabilities") ||
  runtimeContributor.includes('config.read(db, "customFields")') ||
  !runtimeContributor.includes("loadCustomFieldRegistry") ||
  !runtimeContributor.includes("[customFieldsRuntimePort.id]") ||
  !runtimeContributor.includes("resolveRegistry:") ||
  !runtimeContributor.includes("resolveVisibleValues") ||
  !runtimeContributor.includes("[relationshipsMiceRuntimePort.id]")
) {
  violations.push(
    "Relationships must compose database-backed custom fields and MICE lookup package-side",
  )
}
const genericContributorInputs =
  composition.includes("options.createRuntimePorts({ primitives })") ||
  (composition.includes("providerPorts?: VoyantGraphRuntimePorts") &&
    composition.includes("runtimePorts: options.providerPorts"))
if (
  composition.includes("relationshipsRouteRuntimePort") ||
  composition.includes("createDeploymentCapabilities") ||
  !genericContributorInputs
) {
  violations.push("Operator must not bind Relationships-specific runtime behavior")
}
if (composition.includes("operatorGraphRuntimeBindings")) {
  violations.push("Operator compatibility runtime bindings must stay deleted")
}

if (violations.length > 0) {
  console.error("Relationships runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-relationships-runtime-authority: OK (package factory authority; generic Node port binding only)",
)
