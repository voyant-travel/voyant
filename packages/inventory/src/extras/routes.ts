import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { inventoryExtrasService } from "./service.js"
import {
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigListQuerySchema,
  productExtraListQuerySchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

export const inventoryExtrasRoutes = new Hono<Env>()
  .get("/product-extras", async (c) => {
    const query = await parseQuery(c, productExtraListQuerySchema)
    return c.json(await inventoryExtrasService.listProductExtras(c.get("db"), query))
  })
  .post("/product-extras", async (c) => {
    return c.json(
      {
        data: await inventoryExtrasService.createProductExtra(
          c.get("db"),
          await parseJsonBody(c, insertProductExtraSchema),
        ),
      },
      201,
    )
  })
  .get("/product-extras/:id", async (c) => {
    const row = await inventoryExtrasService.getProductExtraById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/product-extras/:id", async (c) => {
    const row = await inventoryExtrasService.updateProductExtra(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductExtraSchema),
    )
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/product-extras/:id", async (c) => {
    const row = await inventoryExtrasService.deleteProductExtra(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ success: true })
  })
  .get("/option-extra-configs", async (c) => {
    const query = await parseQuery(c, optionExtraConfigListQuerySchema)
    return c.json(await inventoryExtrasService.listOptionExtraConfigs(c.get("db"), query))
  })
  .post("/option-extra-configs", async (c) => {
    return c.json(
      {
        data: await inventoryExtrasService.createOptionExtraConfig(
          c.get("db"),
          await parseJsonBody(c, insertOptionExtraConfigSchema),
        ),
      },
      201,
    )
  })
  .get("/option-extra-configs/:id", async (c) => {
    const row = await inventoryExtrasService.getOptionExtraConfigById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/option-extra-configs/:id", async (c) => {
    const row = await inventoryExtrasService.updateOptionExtraConfig(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateOptionExtraConfigSchema),
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/option-extra-configs/:id", async (c) => {
    const row = await inventoryExtrasService.deleteOptionExtraConfig(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ success: true })
  })

export type InventoryExtrasRoutes = typeof inventoryExtrasRoutes
