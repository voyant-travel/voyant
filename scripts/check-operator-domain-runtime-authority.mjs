import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const rootIndex = process.argv.indexOf("--root")
const root = rootIndex === -1 ? defaultRoot : process.argv[rootIndex + 1]
if (!root) throw new Error("--root requires a path")

const violations = []
const read = (path) => {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    violations.push(`missing ${path}`)
    return ""
  }
  return readFileSync(absolute, "utf8")
}
const lines = (source) => (source.length === 0 ? 0 : source.trimEnd().split("\n").length)

for (const path of [
  "starters/operator/src/api/runtime/trips-catalog-runtime.ts",
  "starters/operator/src/api/runtime/trips-checkout-runtime.ts",
  "starters/operator/src/api/runtime/trips-flight-runtime.ts",
]) {
  if (existsSync(join(root, path))) violations.push(`${path} must stay deleted`)
}

const tripsAdapterPath = "starters/operator/src/api/runtime/trips-runtime.ts"
const tripsAdapter = existsSync(join(root, tripsAdapterPath)) ? read(tripsAdapterPath) : ""
if (tripsAdapter) violations.push("Trips deployment adapter must stay deleted")
const tripsRuntime = read("packages/trips/src/runtime.ts")
for (const token of [
  "createTripsRouteRuntime",
  "createCatalogComponentAdapter",
  "VoyantRuntimeHostPrimitives",
]) {
  if (!tripsRuntime.includes(token)) violations.push(`Trips package runtime must own ${token}`)
}

const paymentPolicyFacadePath =
  "starters/operator/src/api/runtime/booking-payment-policy-runtime.ts"
if (existsSync(join(root, paymentPolicyFacadePath))) {
  violations.push(`${paymentPolicyFacadePath} must stay deleted`)
}

const workflowAdapter = read("starters/operator/src/api/runtime/operator-workflow-services.ts")
if (lines(workflowAdapter) > 260) violations.push("Workflow deployment adapter exceeds 260 lines")
for (const token of ["paymentSessions", "createLazyWorkflowDb", "renderProductBrochureTemplate"]) {
  if (workflowAdapter.includes(token))
    violations.push(`Workflow deployment adapter retains ${token}`)
}

for (const path of [
  "packages/trips/src/route-runtime.ts",
  "packages/trips/src/checkout/voyant-fx.ts",
  "packages/finance/src/stale-booking-holds-runtime.ts",
  "packages/distribution/src/channel-push/workflow-entry.ts",
  "packages/inventory/src/workflow-runtime.ts",
  "packages/inventory/src/booking-payment-policy-runtime.ts",
  "packages/accommodations/src/payment-policy-runtime.ts",
  "packages/cruises/src/payment-policy-runtime.ts",
  "packages/distribution/src/payment-policy-runtime.ts",
]) {
  read(path)
}

if (violations.length > 0) {
  console.error("Operator domain runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  `check-operator-domain-runtime-authority: OK (${lines(workflowAdapter)} starter adapter lines; Trips and payment policy package-owned)`,
)
