import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { distributionService } from "../service.js"
import {
  channelInventoryAllotmentListQuerySchema,
  channelInventoryAllotmentTargetListQuerySchema,
  channelInventoryReleaseRuleListQuerySchema,
  insertChannelInventoryAllotmentSchema,
  insertChannelInventoryAllotmentTargetSchema,
  insertChannelInventoryReleaseRuleSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseRuleSchema,
} from "../validation.js"
import {
  batchIdsSchema,
  batchUpdateChannelInventoryAllotmentSchema,
  batchUpdateChannelInventoryAllotmentTargetSchema,
  batchUpdateChannelInventoryReleaseRuleSchema,
  handleBatchDelete,
  handleBatchUpdate,
} from "./batch.js"
import type { DistributionRouteEnv } from "./env.js"

export const inventoryRoutes = new Hono<DistributionRouteEnv>()
  .get("/inventory-allotments", async (c) => {
    const query = await parseQuery(c, channelInventoryAllotmentListQuerySchema)
    return c.json(await distributionService.listInventoryAllotments(c.get("db"), query))
  })
  .post("/inventory-allotments", async (c) => {
    return c.json(
      {
        data: await distributionService.createInventoryAllotment(
          c.get("db"),
          await parseJsonBody(c, insertChannelInventoryAllotmentSchema),
        ),
      },
      201,
    )
  })
  .post("/inventory-allotments/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelInventoryAllotmentSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryAllotment,
      }),
    )
  })
  .post("/inventory-allotments/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryAllotment,
      }),
    )
  })
  .get("/inventory-allotments/:id", async (c) => {
    const row = await distributionService.getInventoryAllotmentById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel inventory allotment not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/inventory-allotments/:id", async (c) => {
    const row = await distributionService.updateInventoryAllotment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelInventoryAllotmentSchema),
    )
    if (!row) return c.json({ error: "Channel inventory allotment not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/inventory-allotments/:id", async (c) => {
    const row = await distributionService.deleteInventoryAllotment(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel inventory allotment not found" }, 404)
    return c.json({ success: true })
  })
  .get("/inventory-allotment-targets", async (c) => {
    const query = await parseQuery(c, channelInventoryAllotmentTargetListQuerySchema)
    return c.json(await distributionService.listInventoryAllotmentTargets(c.get("db"), query))
  })
  .post("/inventory-allotment-targets", async (c) => {
    return c.json(
      {
        data: await distributionService.createInventoryAllotmentTarget(
          c.get("db"),
          await parseJsonBody(c, insertChannelInventoryAllotmentTargetSchema),
        ),
      },
      201,
    )
  })
  .post("/inventory-allotment-targets/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelInventoryAllotmentTargetSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryAllotmentTarget,
      }),
    )
  })
  .post("/inventory-allotment-targets/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryAllotmentTarget,
      }),
    )
  })
  .get("/inventory-allotment-targets/:id", async (c) => {
    const row = await distributionService.getInventoryAllotmentTargetById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Channel inventory allotment target not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/inventory-allotment-targets/:id", async (c) => {
    const row = await distributionService.updateInventoryAllotmentTarget(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelInventoryAllotmentTargetSchema),
    )
    if (!row) return c.json({ error: "Channel inventory allotment target not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/inventory-allotment-targets/:id", async (c) => {
    const row = await distributionService.deleteInventoryAllotmentTarget(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Channel inventory allotment target not found" }, 404)
    return c.json({ success: true })
  })
  .get("/inventory-release-rules", async (c) => {
    const query = await parseQuery(c, channelInventoryReleaseRuleListQuerySchema)
    return c.json(await distributionService.listInventoryReleaseRules(c.get("db"), query))
  })
  .post("/inventory-release-rules", async (c) => {
    return c.json(
      {
        data: await distributionService.createInventoryReleaseRule(
          c.get("db"),
          await parseJsonBody(c, insertChannelInventoryReleaseRuleSchema),
        ),
      },
      201,
    )
  })
  .post("/inventory-release-rules/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelInventoryReleaseRuleSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateInventoryReleaseRule,
      }),
    )
  })
  .post("/inventory-release-rules/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteInventoryReleaseRule,
      }),
    )
  })
  .get("/inventory-release-rules/:id", async (c) => {
    const row = await distributionService.getInventoryReleaseRuleById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Channel inventory release rule not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/inventory-release-rules/:id", async (c) => {
    const row = await distributionService.updateInventoryReleaseRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelInventoryReleaseRuleSchema),
    )
    if (!row) return c.json({ error: "Channel inventory release rule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/inventory-release-rules/:id", async (c) => {
    const row = await distributionService.deleteInventoryReleaseRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel inventory release rule not found" }, 404)
    return c.json({ success: true })
  })
