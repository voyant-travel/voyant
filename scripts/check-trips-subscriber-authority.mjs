import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const paths = {
  manifest: "packages/trips/src/voyant.ts",
  app: "starters/operator/src/api/app.ts",
  tripsRuntime: "starters/operator/src/api/runtime/trips-runtime.ts",
  composition: "starters/operator/src/api/composition.ts",
}

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([name, relativePath]) => [
      name,
      await readFile(path.join(repoRoot, relativePath), "utf8"),
    ]),
  ),
)

const failures = []
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}
const rejectMatch = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message)
}

requireMatch(
  sources.manifest,
  /entry:\s*["']\.\/payment-subscribers["'][\s\S]*export:\s*["']tripsPaymentCompletedSubscriber["']/,
  "Trips manifest must own the payment subscriber runtime reference",
)
rejectMatch(
  sources.app,
  /tripsPaymentBundle|trips-payment-completion/,
  "Operator app must not list a central Trips payment subscriber bundle",
)
rejectMatch(
  sources.tripsRuntime,
  /tripsPaymentBundle|payment\.completed|eventBus\.subscribe/,
  "Operator Trips runtime must not implement payment subscriber authority",
)
requireMatch(
  sources.composition,
  /withModuleRuntimeService\(configured,[\s\S]*TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY/,
  "Operator graph composition must register the Trips payment runtime service",
)
requireMatch(
  sources.composition,
  /withDb:\s*\(bindings, operation\)\s*=>\s*withDbFromEnv\(bindings as AppBindings, operation\)/,
  "Trips payment runtime service must preserve Operator DB lifecycle handling",
)
requireMatch(
  sources.composition,
  /withDb:\s*\(operation\)[\s\S]*capabilities\.withDb/,
  "Trips payment runtime service must consume the generic host DB lifecycle capability",
)
rejectMatch(
  sources.composition,
  /tripsPaymentCompletedSubscriber\.register|eventBus\.subscribe[^\n]*payment\.completed/,
  "Operator composition must leave subscriber registration to selected-graph lowering",
)

if (failures.length > 0) {
  console.error("Trips subscriber authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Trips subscriber authority: OK")
