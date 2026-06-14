import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { distributionService } from "../service.js"
import {
  channelInventoryReleaseExecutionListQuerySchema,
  channelReconciliationItemListQuerySchema,
  channelReconciliationPolicyListQuerySchema,
  channelReconciliationRunListQuerySchema,
  channelReleaseScheduleListQuerySchema,
  channelRemittanceExceptionListQuerySchema,
  channelSettlementApprovalListQuerySchema,
  channelSettlementItemListQuerySchema,
  channelSettlementPolicyListQuerySchema,
  channelSettlementRunListQuerySchema,
  insertChannelInventoryReleaseExecutionSchema,
  insertChannelReconciliationItemSchema,
  insertChannelReconciliationPolicySchema,
  insertChannelReconciliationRunSchema,
  insertChannelReleaseScheduleSchema,
  insertChannelRemittanceExceptionSchema,
  insertChannelSettlementApprovalSchema,
  insertChannelSettlementItemSchema,
  insertChannelSettlementPolicySchema,
  insertChannelSettlementRunSchema,
  updateChannelInventoryReleaseExecutionSchema,
  updateChannelReconciliationItemSchema,
  updateChannelReconciliationPolicySchema,
  updateChannelReconciliationRunSchema,
  updateChannelReleaseScheduleSchema,
  updateChannelRemittanceExceptionSchema,
  updateChannelSettlementApprovalSchema,
  updateChannelSettlementItemSchema,
  updateChannelSettlementPolicySchema,
  updateChannelSettlementRunSchema,
} from "../validation.js"
import type { DistributionRouteEnv } from "./env.js"

export const settlementRoutes = new Hono<DistributionRouteEnv>()
  .get("/settlement-runs", async (c) => {
    const query = await parseQuery(c, channelSettlementRunListQuerySchema)
    return c.json(await distributionService.listSettlementRuns(c.get("db"), query))
  })
  .post("/settlement-runs", async (c) => {
    return c.json(
      {
        data: await distributionService.createSettlementRun(
          c.get("db"),
          await parseJsonBody(c, insertChannelSettlementRunSchema),
        ),
      },
      201,
    )
  })
  .get("/settlement-runs/:id", async (c) => {
    const row = await distributionService.getSettlementRunById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement run not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/settlement-runs/:id", async (c) => {
    const row = await distributionService.updateSettlementRun(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelSettlementRunSchema),
    )
    if (!row) return c.json({ error: "Channel settlement run not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/settlement-runs/:id", async (c) => {
    const row = await distributionService.deleteSettlementRun(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement run not found" }, 404)
    return c.json({ success: true })
  })
  .get("/settlement-items", async (c) => {
    const query = await parseQuery(c, channelSettlementItemListQuerySchema)
    return c.json(await distributionService.listSettlementItems(c.get("db"), query))
  })
  .post("/settlement-items", async (c) => {
    return c.json(
      {
        data: await distributionService.createSettlementItem(
          c.get("db"),
          await parseJsonBody(c, insertChannelSettlementItemSchema),
        ),
      },
      201,
    )
  })
  .get("/settlement-items/:id", async (c) => {
    const row = await distributionService.getSettlementItemById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement item not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/settlement-items/:id", async (c) => {
    const row = await distributionService.updateSettlementItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelSettlementItemSchema),
    )
    if (!row) return c.json({ error: "Channel settlement item not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/settlement-items/:id", async (c) => {
    const row = await distributionService.deleteSettlementItem(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement item not found" }, 404)
    return c.json({ success: true })
  })
  .get("/reconciliation-runs", async (c) => {
    const query = await parseQuery(c, channelReconciliationRunListQuerySchema)
    return c.json(await distributionService.listReconciliationRuns(c.get("db"), query))
  })
  .post("/reconciliation-runs", async (c) => {
    return c.json(
      {
        data: await distributionService.createReconciliationRun(
          c.get("db"),
          await parseJsonBody(c, insertChannelReconciliationRunSchema),
        ),
      },
      201,
    )
  })
  .get("/reconciliation-runs/:id", async (c) => {
    const row = await distributionService.getReconciliationRunById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel reconciliation run not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/reconciliation-runs/:id", async (c) => {
    const row = await distributionService.updateReconciliationRun(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelReconciliationRunSchema),
    )
    if (!row) return c.json({ error: "Channel reconciliation run not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/reconciliation-runs/:id", async (c) => {
    const row = await distributionService.deleteReconciliationRun(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel reconciliation run not found" }, 404)
    return c.json({ success: true })
  })
  .get("/reconciliation-items", async (c) => {
    const query = await parseQuery(c, channelReconciliationItemListQuerySchema)
    return c.json(await distributionService.listReconciliationItems(c.get("db"), query))
  })
  .post("/reconciliation-items", async (c) => {
    return c.json(
      {
        data: await distributionService.createReconciliationItem(
          c.get("db"),
          await parseJsonBody(c, insertChannelReconciliationItemSchema),
        ),
      },
      201,
    )
  })
  .get("/reconciliation-items/:id", async (c) => {
    const row = await distributionService.getReconciliationItemById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel reconciliation item not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/reconciliation-items/:id", async (c) => {
    const row = await distributionService.updateReconciliationItem(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelReconciliationItemSchema),
    )
    if (!row) return c.json({ error: "Channel reconciliation item not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/reconciliation-items/:id", async (c) => {
    const row = await distributionService.deleteReconciliationItem(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel reconciliation item not found" }, 404)
    return c.json({ success: true })
  })
  .get("/inventory-release-executions", async (c) => {
    const query = await parseQuery(c, channelInventoryReleaseExecutionListQuerySchema)
    return c.json(await distributionService.listReleaseExecutions(c.get("db"), query))
  })
  .post("/inventory-release-executions", async (c) => {
    return c.json(
      {
        data: await distributionService.createReleaseExecution(
          c.get("db"),
          await parseJsonBody(c, insertChannelInventoryReleaseExecutionSchema),
        ),
      },
      201,
    )
  })
  .get("/inventory-release-executions/:id", async (c) => {
    const row = await distributionService.getReleaseExecutionById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel inventory release execution not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/inventory-release-executions/:id", async (c) => {
    const row = await distributionService.updateReleaseExecution(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelInventoryReleaseExecutionSchema),
    )
    if (!row) return c.json({ error: "Channel inventory release execution not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/inventory-release-executions/:id", async (c) => {
    const row = await distributionService.deleteReleaseExecution(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel inventory release execution not found" }, 404)
    return c.json({ success: true })
  })
  .get("/settlement-policies", async (c) => {
    const query = await parseQuery(c, channelSettlementPolicyListQuerySchema)
    return c.json(await distributionService.listSettlementPolicies(c.get("db"), query))
  })
  .post("/settlement-policies", async (c) =>
    c.json(
      {
        data: await distributionService.createSettlementPolicy(
          c.get("db"),
          await parseJsonBody(c, insertChannelSettlementPolicySchema),
        ),
      },
      201,
    ),
  )
  .get("/settlement-policies/:id", async (c) => {
    const row = await distributionService.getSettlementPolicyById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement policy not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/settlement-policies/:id", async (c) => {
    const row = await distributionService.updateSettlementPolicy(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelSettlementPolicySchema),
    )
    if (!row) return c.json({ error: "Channel settlement policy not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/settlement-policies/:id", async (c) => {
    const row = await distributionService.deleteSettlementPolicy(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement policy not found" }, 404)
    return c.json({ success: true })
  })
  .get("/reconciliation-policies", async (c) => {
    const query = await parseQuery(c, channelReconciliationPolicyListQuerySchema)
    return c.json(await distributionService.listReconciliationPolicies(c.get("db"), query))
  })
  .post("/reconciliation-policies", async (c) =>
    c.json(
      {
        data: await distributionService.createReconciliationPolicy(
          c.get("db"),
          await parseJsonBody(c, insertChannelReconciliationPolicySchema),
        ),
      },
      201,
    ),
  )
  .get("/reconciliation-policies/:id", async (c) => {
    const row = await distributionService.getReconciliationPolicyById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Channel reconciliation policy not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/reconciliation-policies/:id", async (c) => {
    const row = await distributionService.updateReconciliationPolicy(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelReconciliationPolicySchema),
    )
    if (!row) return c.json({ error: "Channel reconciliation policy not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/reconciliation-policies/:id", async (c) => {
    const row = await distributionService.deleteReconciliationPolicy(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel reconciliation policy not found" }, 404)
    return c.json({ success: true })
  })
  .get("/release-schedules", async (c) => {
    const query = await parseQuery(c, channelReleaseScheduleListQuerySchema)
    return c.json(await distributionService.listReleaseSchedules(c.get("db"), query))
  })
  .post("/release-schedules", async (c) =>
    c.json(
      {
        data: await distributionService.createReleaseSchedule(
          c.get("db"),
          await parseJsonBody(c, insertChannelReleaseScheduleSchema),
        ),
      },
      201,
    ),
  )
  .get("/release-schedules/:id", async (c) => {
    const row = await distributionService.getReleaseScheduleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel release schedule not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/release-schedules/:id", async (c) => {
    const row = await distributionService.updateReleaseSchedule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelReleaseScheduleSchema),
    )
    if (!row) return c.json({ error: "Channel release schedule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/release-schedules/:id", async (c) => {
    const row = await distributionService.deleteReleaseSchedule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel release schedule not found" }, 404)
    return c.json({ success: true })
  })
  .get("/remittance-exceptions", async (c) => {
    const query = await parseQuery(c, channelRemittanceExceptionListQuerySchema)
    return c.json(await distributionService.listRemittanceExceptions(c.get("db"), query))
  })
  .post("/remittance-exceptions", async (c) =>
    c.json(
      {
        data: await distributionService.createRemittanceException(
          c.get("db"),
          await parseJsonBody(c, insertChannelRemittanceExceptionSchema),
        ),
      },
      201,
    ),
  )
  .get("/remittance-exceptions/:id", async (c) => {
    const row = await distributionService.getRemittanceExceptionById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel remittance exception not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/remittance-exceptions/:id", async (c) => {
    const row = await distributionService.updateRemittanceException(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelRemittanceExceptionSchema),
    )
    if (!row) return c.json({ error: "Channel remittance exception not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/remittance-exceptions/:id", async (c) => {
    const row = await distributionService.deleteRemittanceException(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel remittance exception not found" }, 404)
    return c.json({ success: true })
  })
  .get("/settlement-approvals", async (c) => {
    const query = await parseQuery(c, channelSettlementApprovalListQuerySchema)
    return c.json(await distributionService.listSettlementApprovals(c.get("db"), query))
  })
  .post("/settlement-approvals", async (c) =>
    c.json(
      {
        data: await distributionService.createSettlementApproval(
          c.get("db"),
          await parseJsonBody(c, insertChannelSettlementApprovalSchema),
        ),
      },
      201,
    ),
  )
  .get("/settlement-approvals/:id", async (c) => {
    const row = await distributionService.getSettlementApprovalById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement approval not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/settlement-approvals/:id", async (c) => {
    const row = await distributionService.updateSettlementApproval(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelSettlementApprovalSchema),
    )
    if (!row) return c.json({ error: "Channel settlement approval not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/settlement-approvals/:id", async (c) => {
    const row = await distributionService.deleteSettlementApproval(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel settlement approval not found" }, 404)
    return c.json({ success: true })
  })
