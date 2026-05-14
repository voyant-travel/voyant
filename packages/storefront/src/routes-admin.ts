import { ApiHttpError, parseJsonBody } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  createStorefrontService,
  type StorefrontRequestContext,
  type StorefrontServiceOptions,
} from "./service.js"
import { storefrontSettingsPatchSchema } from "./validation.js"

type Env = {
  Variables: {
    db: unknown
  }
}

function getRequestContext(c: Context<Env>): StorefrontRequestContext {
  return {
    db: c.get("db" as never) as StorefrontRequestContext["db"],
    env: c.env,
    context: c,
  } satisfies StorefrontRequestContext
}

export function createStorefrontAdminRoutes(options?: StorefrontServiceOptions) {
  const storefrontService = createStorefrontService(options)

  return new Hono<Env>()
    .get("/settings", async (c) => {
      return c.json({ data: await storefrontService.resolveSettings(getRequestContext(c)) })
    })
    .patch("/settings", async (c) => {
      const updated = await storefrontService.updateSettings(
        await parseJsonBody(c, storefrontSettingsPatchSchema),
        getRequestContext(c),
      )

      if (!updated) {
        throw new ApiHttpError("Storefront settings updates are not configured", {
          status: 409,
          code: "storefront_settings_update_not_configured",
        })
      }

      return c.json({ data: updated })
    })
}

export type StorefrontAdminRoutes = ReturnType<typeof createStorefrontAdminRoutes>
