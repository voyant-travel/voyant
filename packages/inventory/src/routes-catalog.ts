import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productCatalogRoutes = new Hono<Env>()
  // ==========================================================================
  // Product Types
  // ==========================================================================

  .get("/product-types", async (c) => {
    const query = parseQuery(c, validation.productTypeListQuerySchema)
    return c.json(await productsService.listProductTypes(c.get("db"), query))
  })

  .get("/product-types/:typeId", async (c) => {
    const row = await productsService.getProductTypeById(c.get("db"), c.req.param("typeId"))
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-types", async (c) => {
    return c.json(
      {
        data: await productsService.createProductType(
          c.get("db"),
          await parseJsonBody(c, validation.insertProductTypeSchema),
        ),
      },
      201,
    )
  })

  .patch("/product-types/:typeId", async (c) => {
    const row = await productsService.updateProductType(
      c.get("db"),
      c.req.param("typeId"),
      await parseJsonBody(c, validation.updateProductTypeSchema),
    )
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-types/:typeId", async (c) => {
    const row = await productsService.deleteProductType(c.get("db"), c.req.param("typeId"))
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product Categories
  // ==========================================================================

  .get("/product-categories", async (c) => {
    const query = parseQuery(c, validation.productCategoryListQuerySchema)
    return c.json(await productsService.listProductCategories(c.get("db"), query))
  })

  .get("/product-categories/:categoryId", async (c) => {
    const row = await productsService.getProductCategoryById(c.get("db"), c.req.param("categoryId"))
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-categories", async (c) => {
    return c.json(
      {
        data: await productsService.createProductCategory(
          c.get("db"),
          await parseJsonBody(c, validation.insertProductCategorySchema),
        ),
      },
      201,
    )
  })

  .patch("/product-categories/:categoryId", async (c) => {
    const row = await productsService.updateProductCategory(
      c.get("db"),
      c.req.param("categoryId"),
      await parseJsonBody(c, validation.updateProductCategorySchema),
    )
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-categories/:categoryId", async (c) => {
    const row = await productsService.deleteProductCategory(c.get("db"), c.req.param("categoryId"))
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product Tags
  // ==========================================================================

  .get("/product-tags", async (c) => {
    const query = parseQuery(c, validation.productTagListQuerySchema)
    return c.json(await productsService.listProductTags(c.get("db"), query))
  })

  .get("/product-tags/:tagId", async (c) => {
    const row = await productsService.getProductTagById(c.get("db"), c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-tags", async (c) => {
    return c.json(
      {
        data: await productsService.createProductTag(
          c.get("db"),
          await parseJsonBody(c, validation.insertProductTagSchema),
        ),
      },
      201,
    )
  })

  .patch("/product-tags/:tagId", async (c) => {
    const row = await productsService.updateProductTag(
      c.get("db"),
      c.req.param("tagId"),
      await parseJsonBody(c, validation.updateProductTagSchema),
    )
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-tags/:tagId", async (c) => {
    const row = await productsService.deleteProductTag(c.get("db"), c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })
