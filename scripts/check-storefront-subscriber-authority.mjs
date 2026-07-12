import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const paths = {
  manifest: "packages/storefront/src/voyant.ts",
  descriptor: "packages/storefront/src/booking-bootstrap-subscriber-runtime.ts",
  storefrontModule: "packages/storefront/src/index.ts",
  operatorComposition: "starters/operator/src/api/runtime/deployment-resources.ts",
  operatorApp: "starters/operator/src/api/app.ts",
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
  /entry:\s*["']\.\/booking-bootstrap-subscriber["'][\s\S]*export:\s*["']storefrontBookingBootstrapSubscriber["']/,
  "Storefront manifest must own the booking-bootstrap subscriber runtime reference",
)
requireMatch(
  sources.descriptor,
  /storefrontBookingBootstrapSubscriber:\s*SubscriberRuntimeDescriptor[\s\S]*eventBus\.subscribe\(BOOKING_BOOTSTRAP_INTENT_EVENT/,
  "Storefront must export an executable booking-bootstrap SubscriberRuntimeDescriptor",
)
requireMatch(
  sources.descriptor,
  /await createBookingBootstrapIntentHandler\([\s\S]*\)\(envelope\)/,
  "Storefront descriptor must execute the existing write-intent handler",
)
rejectMatch(
  sources.descriptor,
  /catch\s*\(/,
  "Storefront descriptor must not swallow infrastructure errors needed for outbox retry",
)
rejectMatch(
  sources.storefrontModule,
  /eventBus\.subscribe|createBookingBootstrapIntentHandler\(/,
  "Storefront module bootstrap must not retain manual subscriber authority",
)
requireMatch(
  sources.storefrontModule,
  /registerStorefrontBookingBootstrapRuntime\(container/,
  "Storefront module must register its package runtime adapter",
)

requireMatch(
  sources.manifest,
  /runtime:\s*\{\s*entry:\s*["']@voyant-travel\/storefront["'],\s*export:\s*["']createStorefrontVoyantRuntime["']\s*\}[\s\S]*runtimePorts:\s*\[requirePort\(storefrontRuntimePort\)\]/,
  "Storefront manifest must compose through its typed runtime port",
)

requireMatch(
  sources.operatorComposition,
  /\[storefrontRuntimePort\.id\]:\s*createOperatorStorefrontRuntimeProvider\(capabilities\)/,
  "Operator must bind the typed Storefront runtime port",
)
requireMatch(
  sources.operatorComposition,
  /function createOperatorStorefrontRuntimeProvider[\s\S]*bookingIntents:[\s\S]*withDbFromEnv\(/,
  "Operator Storefront host must preserve lifecycle-aware booking-intent database access",
)
rejectMatch(
  sources.operatorComposition,
  /["']@voyant-travel\/storefront["']\s*:/,
  "Operator must not restore a package-id Storefront compatibility binding",
)
rejectMatch(
  sources.operatorComposition,
  /storefrontBookingBootstrapSubscriber\.register|eventBus\.subscribe\([^\n]*storefront\.booking\.bootstrap/,
  "Operator composition must leave Storefront subscriber registration to graph lowering",
)
rejectMatch(
  sources.operatorApp,
  /storefrontBookingBootstrapSubscriber|storefrontBookingBootstrapBundle/,
  "Operator app must not list a Storefront booking-bootstrap subscriber",
)

if (failures.length > 0) {
  console.error("Storefront subscriber authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Storefront subscriber authority: OK")
