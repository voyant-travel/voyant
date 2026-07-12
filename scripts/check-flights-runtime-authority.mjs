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
const flightsRoot = pathOption("--flights-root", join(ROOT, "packages/flights"))
const flightsNodeRoot = pathOption("--flights-node-root", join(ROOT, "packages/flights-node"))
const operatorRoot = pathOption("--operator-root", join(ROOT, "starters/operator"))
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-flights-runtime-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

const packageJson = JSON.parse(readRequired(join(flightsRoot, "package.json")))
const nodePackageJson = JSON.parse(readRequired(join(flightsNodeRoot, "package.json")))
const manifest = readRequired(join(flightsRoot, "src/voyant.ts"))
const hono = readRequired(join(flightsRoot, "src/hono.ts"))
const runtimePort = readRequired(join(flightsRoot, "src/runtime-port.ts"))
const composition = readRequired(join(operatorRoot, "src/api/runtime/deployment-resources.ts"))
const nodeContributor = readRequired(join(flightsNodeRoot, "src/runtime-contributor.ts"))
const nodeRuntime = readRequired(join(flightsNodeRoot, "src/standard-node-runtime.ts"))

if (packageJson.dependencies?.["@voyant-travel/finance"] !== "workspace:^") {
  violations.push("Flights must own its @voyant-travel/finance runtime dependency")
}
if (!packageJson.voyant?.requiresSchemas?.includes("@voyant-travel/finance")) {
  violations.push("Flights must declare its Finance payment-session schema dependency")
}
if (
  !manifest.includes("runtimePorts: [requirePort(flightsRuntimePort)]") ||
  !manifest.includes('requires: { capabilities: ["finance.payment-sessions"] }') ||
  !manifest.includes('export: "createFlightsVoyantRuntime"')
) {
  violations.push(
    "Flights manifest must declare its typed port, Finance capability, and package-owned runtime factory",
  )
}
if (
  !hono.includes("defineGraphRuntimeFactory") ||
  !hono.includes("getPort(flightsRuntimePort)") ||
  !hono.includes('createOrderPaymentSessions({ targetType: "flight_order" })')
) {
  violations.push("Flights must assemble routes and payment sessions inside its graph factory")
}
for (const method of ["resolveAdapter", "startCardPayment"]) {
  if (!runtimePort.includes(`"${method}"`)) {
    violations.push(`flights.runtime conformance must require ${method}()`)
  }
}
if (packageJson.voyant?.runtime || packageJson.exports?.["./runtime-contributor"]) {
  violations.push("Flights domain package must not retain target-specific runtime authority")
}
if (composition.includes("operatorGraphRuntimeBindings")) {
  violations.push("Operator compatibility runtime bindings must stay deleted")
}
if (composition.includes("loadFlightAdminRoutes")) {
  violations.push("Operator must not retain the Flights compatibility route loader")
}
if (
  nodePackageJson.voyant?.runtime?.export !== "createFlightsNodeRuntimePortContribution" ||
  !nodeContributor.includes("primitives: VoyantRuntimeHostPrimitives") ||
  !nodeContributor.includes("createFlightsStandardNodeRuntime(host.primitives)")
) {
  violations.push("Flights Node adapter must own runtime contribution from generic primitives")
}
for (const token of ["resolveAdapter(c)", "startCardPayment", "createDemoFlightAdapter"]) {
  if (!nodeRuntime.includes(token)) violations.push(`Flights Node runtime must preserve ${token}`)
}
if (composition.includes("loadFlightsRuntime") || composition.includes("./flights-runtime")) {
  violations.push("Operator must not retain a Flights runtime loader or facade")
}

if (violations.length > 0) {
  console.error("Flights runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-flights-runtime-authority: OK (BOM-selected Flights Node adapter authority)")
