import { parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { publicCustomerPortalService } from "./service-public.js"
import {
  customerPortalContactExistsQuerySchema,
  customerPortalPhoneContactExistsQuerySchema,
} from "./validation-public.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

export const customerPortalRoutes = new Hono<Env>()
  .get("/contact-exists", async (c) => {
    const query = parseQuery(c, customerPortalContactExistsQuerySchema)

    return c.json({
      data: await publicCustomerPortalService.contactExists(c.get("db"), query.email),
    })
  })

  .get("/contact-exists/phone", async (c) => {
    const query = parseQuery(c, customerPortalPhoneContactExistsQuerySchema)

    return c.json({
      data: await publicCustomerPortalService.phoneContactExists(c.get("db"), query.phone),
    })
  })

export type CustomerPortalRoutes = typeof customerPortalRoutes
