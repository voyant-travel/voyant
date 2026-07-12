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
const tripsRoot = pathOption("--trips-root", join(ROOT, "packages/trips"))
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-trips-runtime-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`check-trips-runtime-authority: could not locate ${start}`)
  }
  return source.slice(startIndex, endIndex)
}

const manifest = readRequired(join(tripsRoot, "src/voyant.ts"))
const packageIndex = readRequired(join(tripsRoot, "src/index.ts"))
const runtimePort = readRequired(join(tripsRoot, "src/runtime-port.ts"))
const composition = readRequired(join(operatorRoot, "src/api/runtime/deployment-resources.ts"))
const runtimePorts = section(
  composition,
  "function createDeploymentPortResources",
  "const createOperatorTripsRoutesOptions",
)

if (
  !manifest.includes("requirePort(tripsRoutesRuntimePort)") ||
  !manifest.includes("requirePort(tripsDatabaseRuntimePort)") ||
  !manifest.includes('export: "createTripsVoyantRuntime"')
) {
  violations.push("Trips manifest must own both runtime dependencies and its graph factory")
}
if (
  !runtimePort.includes("definePort<TripsRoutesOptionsProvider>") ||
  !runtimePort.includes('id: "trips.routes-runtime"') ||
  !runtimePort.includes("definePort<TripsDatabaseRuntime>") ||
  !runtimePort.includes('id: "trips.database-runtime"')
) {
  violations.push("Trips must define typed route and database runtime ports")
}
if (
  !packageIndex.includes("createTripsVoyantRuntime = defineGraphRuntimeFactory") ||
  !packageIndex.includes("async ({ api, getPort })") ||
  !packageIndex.includes('surface === "admin"') ||
  !packageIndex.includes('surface === "public"') ||
  !packageIndex.includes("getPort(tripsRoutesRuntimePort)") ||
  !packageIndex.includes("getPort(tripsDatabaseRuntimePort)") ||
  !packageIndex.includes("requiresTransactionalDb: true")
) {
  violations.push("Trips must compose its routes and transactional lifecycle in its graph factory")
}
if (packageIndex.includes("tripsHonoModule")) {
  violations.push("Trips must not retain the preconfigured compatibility module export")
}
if (
  !composition.includes('from "@voyant-travel/trips/voyant"') ||
  !runtimePorts.includes("[tripsRoutesRuntimePort.id]") ||
  !runtimePorts.includes("[tripsDatabaseRuntimePort.id]")
) {
  violations.push("Operator must supply only the generic Trips runtime ports")
}
if (composition.includes("operatorGraphRuntimeBindings")) {
  violations.push("Operator compatibility runtime bindings must stay deleted")
}

if (violations.length > 0) {
  console.error("Trips runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-trips-runtime-authority: OK (package factory authority; generic Node ports only)",
)
