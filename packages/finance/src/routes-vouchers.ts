import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"
import { VoucherServiceError } from "./service-vouchers.js"
import {
  insertVoucherSchema,
  redeemVoucherSchema,
  updateVoucherSchema,
  voucherListQuerySchema,
} from "./validation.js"

export const financeVoucherRoutes = new Hono<Env>()

  // ========================================================================
  // Vouchers — issuance, lookup, redemption
  // ========================================================================

  .get("/vouchers", async (c) => {
    const query = parseQuery(c, voucherListQuerySchema)
    return c.json(await financeService.vouchers.list(c.get("db"), query))
  })

  .post("/vouchers", async (c) => {
    try {
      const row = await financeService.vouchers.create(
        c.get("db"),
        await parseJsonBody(c, insertVoucherSchema),
        c.get("userId"),
      )
      return c.json({ data: row }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError && error.code === "code_in_use") {
        return c.json({ error: "Voucher code already in use" }, 409)
      }
      throw error
    }
  })

  .get("/vouchers/:id", async (c) => {
    const row = await financeService.vouchers.getById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Voucher not found" }, 404)
    return c.json({ data: row })
  })

  .patch("/vouchers/:id", async (c) => {
    const row = await financeService.vouchers.update(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateVoucherSchema),
    )
    if (!row) return c.json({ error: "Voucher not found" }, 404)
    return c.json({ data: row })
  })

  .post("/vouchers/:id/redeem", async (c) => {
    try {
      const result = await financeService.vouchers.redeem(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, redeemVoucherSchema),
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      if (error instanceof VoucherServiceError) {
        const status =
          error.code === "voucher_not_found"
            ? 404
            : error.code === "insufficient_balance"
              ? 409
              : 422
        return c.json({ error: error.code }, status)
      }
      throw error
    }
  })
