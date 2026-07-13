// voyant-route-owner: federated deployment probe pending a package-owned source-connections module.
import { Hono } from "hono"

type Env = {
  Variables: {
    userId?: string
  }
}

export const sourceConnectionRoutes = new Hono<Env>()
  .get("/v1/admin/source-connections", (c) =>
    c.json({
      data: [],
      meta: {
        status: "not_configured",
        message: "Source connection storage is not implemented in this starter slice.",
      },
    }),
  )
  .get("/v1/admin/source-connections/health", (c) =>
    c.json({
      data: {
        status: "not_configured",
        checkedAt: new Date().toISOString(),
        connections: [],
      },
    }),
  )
