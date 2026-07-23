import { mkdirSync, writeFileSync } from "node:fs"
import { OpenAPIHono } from "@hono/zod-openapi"

import { createOperatorWebhookAdminRoutes } from "../src/admin-routes.js"

const output = new URL("../openapi/admin/operator-webhooks.json", import.meta.url)
const app = new OpenAPIHono()
app.route(
  "/v1/admin/webhooks",
  createOperatorWebhookAdminRoutes({
    contracts: [],
  }),
)

const document = app.getOpenAPIDocument({
  openapi: "3.1.0",
  info: {
    title: "Voyant Operator Webhooks Admin API",
    version: "1.0.0",
  },
})

mkdirSync(new URL("../openapi/admin/", import.meta.url), { recursive: true })
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`)
