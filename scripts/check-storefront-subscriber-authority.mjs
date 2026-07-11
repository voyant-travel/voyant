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
  framework: "packages/framework/src/composition.ts",
  frameworkLazy: "packages/framework/src/composition-lazy.ts",
  operatorComposition: "starters/operator/src/api/composition.ts",
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

for (const [name, source] of [
  ["framework composition", sources.framework],
  ["lazy framework composition", sources.frameworkLazy],
]) {
  requireMatch(
    source,
    /bookingIntents:\s*capabilities\.withDb\s*\?\s*\{[\s\S]*?withDb:[\s\S]*?capabilities\.withDb!\(bindings/,
    `${name} must enable Storefront intents only through the generic database lifecycle capability`,
  )
  rejectMatch(
    source,
    /storefrontBookingBootstrapSubscriber|STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY|bookingIntents:\s*\{\s*resolveDb/,
    `${name} must not register or directly resolve the Storefront subscriber`,
  )
}

requireMatch(
  sources.operatorComposition,
  /withDb:\s*\(bindings, operation\)\s*=>[\s\S]*withDbFromEnv\(bindings as AppBindings/,
  "Operator composition must provide lifecycle-aware generic withDb",
)
requireMatch(
  sources.operatorComposition,
  /["']@voyant-travel\/storefront["']:\s*frameworkComposition\.modules\[["']@voyant-travel\/storefront["']\]/,
  "Operator must configure the selected Storefront unit through shared framework composition",
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
