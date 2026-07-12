#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const manifests = [
  "packages/catalog/src/voyant.ts",
  "packages/commerce/src/voyant.ts",
  "packages/inventory/src/voyant.ts",
].map((file) => [file, readFileSync(file, "utf8")])

const claims = new Map([
  ["@voyant-travel/catalog#api.admin", "catalog"],
  ["@voyant-travel/catalog#api.public", "catalog"],
  ["@voyant-travel/catalog#booking-engine.api.admin", "catalog-booking"],
  ["@voyant-travel/catalog#booking-engine.api.public", "catalog-booking"],
  ["@voyant-travel/catalog#offers-extension.api", "catalog"],
  ["@voyant-travel/commerce#api.pricing.admin", "pricing"],
  ["@voyant-travel/commerce#api.pricing.public", "pricing"],
  ["@voyant-travel/commerce#api.markets.admin", "markets"],
  ["@voyant-travel/commerce#api.markets.public", "markets"],
  ["@voyant-travel/commerce#api.sellability.admin", "sellability"],
  ["@voyant-travel/commerce#api.promotions.admin", "promotions"],
  ["@voyant-travel/commerce#catalog-checkout-extension.api", "catalog"],
  ["@voyant-travel/commerce#booking-maintenance-extension.api", "bookings"],
  ["@voyant-travel/inventory#api.admin", "products"],
  ["@voyant-travel/inventory#api.public", "products"],
  ["@voyant-travel/inventory#extras.api", "extras"],
  ["@voyant-travel/inventory#content-extension.api.admin", "products"],
  ["@voyant-travel/inventory#content-extension.api.public", "products"],
  ["@voyant-travel/inventory#brochure-extension.api.admin", "products"],
])

for (const [apiId, document] of claims) {
  const source = manifests.find(([, content]) => content.includes(`id: "${apiId}"`))
  assert(source, `missing retail graph API bundle ${apiId}`)
  const start = source[1].indexOf(`id: "${apiId}"`)
  const declaration = source[1].slice(start, start + 420)
  assert.match(
    declaration,
    new RegExp(`openapi: \\{ document: "${document}" \\}`),
    `${apiId} must own the ${document} document`,
  )
}

for (const file of [
  "packages/catalog/src/graph-runtime.ts",
  "packages/catalog/src/booking-engine/operator-routes.ts",
  "packages/inventory/src/graph-runtime.ts",
  "packages/commerce/src/checkout/routes.ts",
]) {
  assert.match(
    readFileSync(file, "utf8"),
    /stampOpenApiRegistryApiId/,
    `${file} must preserve exact operation ownership at overlapping mounts`,
  )
}

const coverageChecker = readFileSync("scripts/check-deployment-graph-openapi-coverage.mjs", "utf8")
assert.match(coverageChecker, /MIN_PACKAGE_OWNED_API_BUNDLES = 33/)

console.log(`check-retail-openapi-authority: OK (${claims.size} package-owned API bundles)`)
