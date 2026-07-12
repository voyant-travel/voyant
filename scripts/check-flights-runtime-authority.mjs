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
const operatorRoot = pathOption("--operator-root", join(ROOT, "starters/operator"))
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-flights-runtime-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`check-flights-runtime-authority: could not locate ${start}`)
  }
  return source.slice(startIndex, endIndex)
}

const packageJson = JSON.parse(readRequired(join(flightsRoot, "package.json")))
const manifest = readRequired(join(flightsRoot, "src/voyant.ts"))
const hono = readRequired(join(flightsRoot, "src/hono.ts"))
const runtimePort = readRequired(join(flightsRoot, "src/runtime-port.ts"))
const composition = readRequired(join(operatorRoot, "src/api/runtime/deployment-resources.ts"))
const operatorRuntime = readRequired(join(operatorRoot, "src/api/runtime/flights-runtime.ts"))
const runtimePorts = section(
  composition,
  "function createDeploymentPortResources",
  "function createLazyCatalogSearchRuntime",
)

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
if (!runtimePorts.includes("[flightsRuntimePort.id]")) {
  violations.push("Operator must bind Flights through flightsRuntimePort.id")
}
if (composition.includes("operatorGraphRuntimeBindings")) {
  violations.push("Operator compatibility runtime bindings must stay deleted")
}
if (composition.includes("loadFlightAdminRoutes")) {
  violations.push("Operator must not retain the Flights compatibility route loader")
}
if (
  !operatorRuntime.includes("operatorFlightsRuntime: FlightsRuntime") ||
  /createFlightsHonoModule|createFlightAdminRoutes|createOrderPaymentSessions/.test(operatorRuntime)
) {
  violations.push("Operator Flights runtime must contain Node providers only")
}

if (violations.length > 0) {
  console.error("Flights runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-flights-runtime-authority: OK (package runtime authority; Node host providers only)",
)
