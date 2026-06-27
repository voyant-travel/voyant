import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { publicCustomerPortalService } from "./service-public.js"
import {
  customerPortalContactExistsQuerySchema,
  customerPortalContactExistsResultSchema,
  customerPortalPhoneContactExistsQuerySchema,
  customerPortalPhoneContactExistsResultSchema,
} from "./validation-public.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const contactExistsRoute = createRoute({
  method: "get",
  path: "/contact-exists",
  request: { query: customerPortalContactExistsQuerySchema },
  responses: {
    200: {
      description: "Whether an auth account and/or customer record exists for an email",
      content: {
        "application/json": {
          schema: z.object({ data: customerPortalContactExistsResultSchema }),
        },
      },
    },
  },
})

const phoneContactExistsRoute = createRoute({
  method: "get",
  path: "/contact-exists/phone",
  request: { query: customerPortalPhoneContactExistsQuerySchema },
  responses: {
    200: {
      description: "Whether an auth account and/or customer record exists for a phone number",
      content: {
        "application/json": {
          schema: z.object({ data: customerPortalPhoneContactExistsResultSchema }),
        },
      },
    },
  },
})

export const customerPortalRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(contactExistsRoute, async (c) => {
    const query = c.req.valid("query")

    return c.json(
      { data: await publicCustomerPortalService.contactExists(c.get("db"), query.email) },
      200,
    )
  })
  .openapi(phoneContactExistsRoute, async (c) => {
    const query = c.req.valid("query")

    return c.json(
      { data: await publicCustomerPortalService.phoneContactExists(c.get("db"), query.phone) },
      200,
    )
  })

export type CustomerPortalRoutes = typeof customerPortalRoutes
