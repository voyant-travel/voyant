import { writeFile } from "node:fs/promises"
import { OpenAPIHono } from "@hono/zod-openapi"

import type { OpenApiDocument } from "@voyant-travel/hono/openapi"
import { generateOpenApiDocument } from "@voyant-travel/hono/openapi"

import { inventoryAuthoringRoutes } from "../src/authoring/extension.js"
import { productRoutes } from "../src/routes.js"
import { createProductBrochureRoutes } from "../src/routes-brochure.js"
import { createProductContentRoutes } from "../src/routes-content.js"
import { publicProductRoutes } from "../src/routes-public.js"

const options = {
  info: {
    title: "Voyant Operator API",
    version: "0.0.0",
    description: "Generated from the composed operator app. Do not edit by hand.",
  },
  servers: [{ url: "/", description: "This deployment (same origin)" }],
}

function withPrefix(document: OpenApiDocument, prefix: string): OpenApiDocument {
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths ?? {}).map(([path, item]) => [
        `${prefix}${path === "/" ? "" : path}`,
        item,
      ]),
    ),
  }
}

async function writeDocument(path: string, document: OpenApiDocument) {
  await writeFile(new URL(path, import.meta.url), `${JSON.stringify(document, null, 2)}\n`)
}

const contentRoutes = () =>
  createProductContentRoutes({
    resolveRegistry: () => null as never,
  })
const generatedAdminRoutes = new OpenAPIHono()
  .route("/", productRoutes)
  .route("/", createProductBrochureRoutes({ resolveStorage: () => null }))
  .route("/", contentRoutes())
const generatedStorefrontRoutes = new OpenAPIHono()
  .route("/", publicProductRoutes)
  .route("/", contentRoutes())

await Promise.all([
  writeDocument(
    "../openapi/admin/products.json",
    withPrefix(generateOpenApiDocument(generatedAdminRoutes, options), "/v1/admin/products"),
  ),
  writeDocument(
    "../openapi/admin/inventory-authoring.json",
    withPrefix(generateOpenApiDocument(inventoryAuthoringRoutes, options), "/v1/admin/products"),
  ),
  writeDocument(
    "../openapi/storefront/products.json",
    withPrefix(generateOpenApiDocument(generatedStorefrontRoutes, options), "/v1/public/products"),
  ),
])
