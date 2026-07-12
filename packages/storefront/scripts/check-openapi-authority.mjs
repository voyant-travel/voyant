#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const manifest = readFileSync("src/voyant.ts", "utf8")
const claims = new Map([
  ["@voyant-travel/storefront#api.admin", "storefront"],
  ["@voyant-travel/storefront#api.public", "storefront"],
  ["@voyant-travel/storefront#customer-portal.api", "customer-portal"],
  ["@voyant-travel/storefront#verification.api", "storefront-verification"],
  ["@voyant-travel/storefront#payment-link.api", "payment-link"],
])

for (const [apiId, document] of claims) {
  const start = manifest.indexOf(`id: "${apiId}"`)
  assert.notEqual(start, -1, `missing Storefront graph API bundle ${apiId}`)
  assert.match(
    manifest.slice(start, start + 360),
    new RegExp(`openapi: \\{ document: "${document}" \\}`),
    `${apiId} must own the ${document} document`,
  )
}

for (const [file, apiId] of [
  ["openapi/admin/storefront.json", "@voyant-travel/storefront#api.admin"],
  ["openapi/storefront/storefront.json", "@voyant-travel/storefront#api.public"],
  ["openapi/storefront/customer-portal.json", "@voyant-travel/storefront#customer-portal.api"],
  ["openapi/storefront/payment-link.json", "@voyant-travel/storefront#payment-link.api"],
  ["openapi/storefront/storefront-verification.json", "@voyant-travel/storefront#verification.api"],
]) {
  const document = JSON.parse(readFileSync(file, "utf8"))
  const operations = Object.values(document.paths ?? {}).flatMap((pathItem) =>
    Object.values(pathItem ?? {}).filter(
      (operation) => operation && typeof operation === "object" && "responses" in operation,
    ),
  )
  assert(operations.length > 0, `${file} must contain operations`)
  assert(
    operations.every(
      (operation) =>
        operation["x-voyant-api-id"] === apiId &&
        operation["x-voyant-package-name"] === "@voyant-travel/storefront",
    ),
    `${file} must preserve exact Storefront graph ownership`,
  )
}

console.log(`check-storefront-openapi-authority: OK (${claims.size} package-owned API bundles)`)
