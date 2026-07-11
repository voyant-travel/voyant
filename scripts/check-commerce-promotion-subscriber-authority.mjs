import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const paths = {
  manifest: "packages/commerce/src/voyant.ts",
  descriptor: "packages/commerce/src/promotions/subscriber-runtime.ts",
  app: "starters/operator/src/api/app.ts",
  catalogBridge: "starters/operator/src/api/subscribers/catalog-bridge.ts",
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

const promotionRuntimeReferences = sources.manifest.match(
  /entry:\s*["']\.\/promotion-redemption-subscriber["'][\s\S]*?export:\s*["']createPromotionRedemptionSubscriberGraphRuntime["']/g,
)
if (promotionRuntimeReferences?.length !== 1) {
  failures.push(
    "Commerce manifest must own the promotion-redemption subscriber runtime reference exactly once",
  )
}
for (const port of ["promotionRedemptionDatabaseRuntimePort", "promotionsBulkReindexRuntimePort"]) {
  requireMatch(
    sources.manifest,
    new RegExp(`requirePort\\(${port}\\)`),
    `Commerce manifest must require ${port}`,
  )
  requireMatch(
    sources.descriptor,
    new RegExp(`getPort\\(${port}\\)`),
    `Commerce subscriber runtime must resolve ${port}`,
  )
  requireMatch(
    sources.composition,
    new RegExp(`\\[${port}\\.id\\]`),
    `Operator must provide ${port} through the runtime port map`,
  )
}
requireMatch(
  sources.descriptor,
  /eventBus\.subscribe<BookingConfirmedPayload>\(["']booking\.confirmed["']/,
  "Commerce descriptor must subscribe to booking.confirmed",
)
requireMatch(
  sources.descriptor,
  /container\.register\([\s\S]*BULK_REINDEX_SERVICE_KEY[\s\S]*await descriptor\.register\(context\)/,
  "Commerce runtime must register the bulk-reindex service before the redemption subscriber",
)
requireMatch(
  sources.composition,
  /promotionRedemptionDatabaseRuntimePort\.id\]:\s*\{[\s\S]*withDb:[\s\S]*withDbFromEnv\(operatorBindings\(bindings\)/,
  "Operator promotion redemption must preserve database lifecycle ownership",
)
requireMatch(
  sources.composition,
  /promotionRedemptionDatabaseRuntimePort\.id\]:[\s\S]*satisfies PromotionRedemptionDatabaseRuntime/,
  "Operator promotion database provider must satisfy its package-owned type",
)
requireMatch(
  sources.composition,
  /promotionsBulkReindexRuntimePort\.id\]:\s*\{[\s\S]*createBulkReindexProductsService\(operatorBindings\(bindings\)\)/,
  "Operator must expose the existing bulk-reindex host service through its typed port",
)
requireMatch(
  sources.composition,
  /promotionsBulkReindexRuntimePort\.id\]:[\s\S]*satisfies PromotionsBulkReindexRuntime/,
  "Operator bulk-reindex provider must satisfy its package-owned type",
)
rejectMatch(
  sources.app,
  /operator-promotions-runtime|BULK_REINDEX_SERVICE_KEY|createBulkReindexProductsService/,
  "Operator app must not register package-specific promotions runtime wiring",
)
rejectMatch(
  sources.catalogBridge,
  /recordPromotionRedemptionsForBooking|promotion redemption recorder failed/,
  "Catalog bridge must not retain promotion-redemption subscriber authority",
)
rejectMatch(
  sources.composition,
  /eventBus\.subscribe[^\n]*booking\.confirmed|createPromotionRedemptionSubscriberRuntime\(/,
  "Operator composition must leave promotion subscriber registration to graph lowering",
)

if (failures.length > 0) {
  console.error("Commerce promotion subscriber authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Commerce promotion subscriber authority: OK")
