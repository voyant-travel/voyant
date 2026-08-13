/**
 * Regenerate the package-owned operator API documents for Trips.
 *
 * `openapi/admin/trips.json` and `openapi/storefront/trips.json` had no
 * generator, so they were only ever as current as the last person who
 * remembered to hand-edit a document whose own header says "Do not edit by
 * hand". Nothing compared them to the routes: the deployment-graph coverage
 * check validates that a document exists for a surface/module pair, not that
 * it describes the legs that are actually mounted.
 *
 * Mirrors `packages/operations/scripts/generate-openapi.ts`, including the
 * `stampModuleMetadata` call: these package-owned documents are generated
 * outside the application manifest composer, so the same metadata stamping has
 * to be run explicitly for operation ids, summaries, owner and surface to match
 * what the composer would have produced.
 */

import { writeFile } from "node:fs/promises"

import type { OpenApiDocument } from "@voyant-travel/hono/openapi"
import { generateOpenApiDocument, stampModuleMetadata } from "@voyant-travel/hono/openapi"

import { createTripsRoutes } from "../src/routes.js"

const options = {
  info: {
    title: "Voyant Operator API",
    version: "0.0.0",
    description: "Generated from the composed operator app. Do not edit by hand.",
  },
  servers: [{ url: "/", description: "This deployment (same origin)" }],
}

/**
 * The same factory produces both documents — admin-only legs are documented on
 * the public surface too and answer 403 there at runtime, which is the existing
 * contract `createTripsApiModule` mounts. Surface is therefore not passed here.
 */
const targets = [
  { file: "../openapi/admin/trips.json", prefix: "/v1/admin/trips" },
  { file: "../openapi/storefront/trips.json", prefix: "/v1/public/trips" },
] as const

function withPrefix(document: OpenApiDocument, prefix: string): OpenApiDocument {
  const prefixed = {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths ?? {}).map(([path, item]) => [
        `${prefix}${path === "/" ? "" : path}`,
        item,
      ]),
    ),
  } as OpenApiDocument

  return stampModuleMetadata(prefixed, new Map())
}

function serialize(document: OpenApiDocument) {
  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * The `generate:openapi` script pipes this through `biome format --write`, the
 * way `@voyant-travel/catalog` does, so the checked-in bytes are the ones
 * `verify:openapi-drift` regenerates and compares. That check is registered in
 * `scripts/checks/openapi/generated-specs.json` and is what stops these
 * drifting again: it fails the moment a Trips route is added, removed or
 * reshaped without regenerating.
 */
await Promise.all(
  targets.map(({ file, prefix }) =>
    writeFile(
      new URL(file, import.meta.url),
      serialize(withPrefix(generateOpenApiDocument(createTripsRoutes(), options), prefix)),
    ),
  ),
)
