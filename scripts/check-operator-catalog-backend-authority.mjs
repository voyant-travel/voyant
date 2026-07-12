import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const boundaries = new Map([
  ["starters/operator/src/api/lib/catalog-runtime.ts", 192],
  ["starters/operator/src/api/runtime/catalog-booking-runtime.ts", 274],
  ["starters/operator/src/api/runtime/catalog-booking-shape-enricher.ts", 15],
  ["starters/operator/src/api/runtime/catalog-offers-runtime.ts", 76],
  ["starters/operator/src/api/runtime/catalog-subscriber-runtime.ts", 83],
])

let total = 0
for (const [relativePath, maximumLines] of boundaries) {
  const source = readFileSync(resolve(root, relativePath), "utf8")
  const lines = source.trimEnd().split("\n").length
  total += lines
  if (lines > maximumLines) {
    throw new Error(`${relativePath} grew to ${lines} lines (maximum: ${maximumLines})`)
  }
  for (const token of [
    "function createTypesenseFetchClient",
    "function isPackageOffer",
    "function merchandisableText",
    "function uniqueSlices",
    "createEnsureCatalogCollectionsSerializer",
  ]) {
    if (source.includes(token)) {
      throw new Error(`${relativePath} regained Catalog package behavior: ${token}`)
    }
  }
}

const packageRuntimePath = "packages/catalog/src/operator-runtime.ts"
const packageRuntime = readFileSync(resolve(root, packageRuntimePath), "utf8")
for (const authority of [
  "buildCatalogSlices",
  "buildCatalogTypesenseIndexer",
  "createCatalogOffersTypesenseResolvers",
  "createProductQuoteShapeEnricher",
  "buildSourcedBookingRowValues",
  "createCatalogPackageHoldPreparer",
  "resolveCatalogHoldTtlMs",
  "applyCatalogTaxToQuoteResult",
  "createCatalogProjectionRuntimeAdapter",
  "createCatalogBookingSnapshotRuntimeAdapter",
]) {
  if (
    !packageRuntime.includes(`export function ${authority}`) &&
    !packageRuntime.includes(`export async function ${authority}`)
  ) {
    throw new Error(`${packageRuntimePath} must own ${authority}`)
  }
}

for (const forbidden of [
  "starters/operator",
  "@voyant-travel/inventory",
  "@voyant-travel/commerce",
]) {
  if (packageRuntime.includes(forbidden)) {
    throw new Error(`${packageRuntimePath} must not depend on ${forbidden}`)
  }
}

if (total > 640) throw new Error(`Operator Catalog backend grew to ${total} lines (maximum: 640)`)
console.log(`Operator Catalog backend authority: ${total}/640 starter adapter lines`)
