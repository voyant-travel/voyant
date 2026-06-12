// agent-quality: file-size exception -- owner: distribution; existing route module stays co-located until a dedicated split preserves behavior and tests.
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import {
  insertContactPointForEntitySchema,
  insertNamedContactForEntitySchema,
  updateContactPointSchema as updateIdentityContactPointSchema,
  updateNamedContactSchema as updateIdentityNamedContactSchema,
} from "@voyantjs/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import { distributionService } from "./service.js"
import {
  channelBookingLinkListQuerySchema,
  channelCommissionRuleListQuerySchema,
  channelContractListQuerySchema,
  channelInventoryAllotmentListQuerySchema,
  channelInventoryAllotmentTargetListQuerySchema,
  channelInventoryReleaseExecutionListQuerySchema,
  channelInventoryReleaseRuleListQuerySchema,
  channelListQuerySchema,
  channelProductMappingListQuerySchema,
  channelReconciliationItemListQuerySchema,
  channelReconciliationPolicyListQuerySchema,
  channelReconciliationRunListQuerySchema,
  channelReleaseScheduleListQuerySchema,
  channelRemittanceExceptionListQuerySchema,
  channelSettlementApprovalListQuerySchema,
  channelSettlementItemListQuerySchema,
  channelSettlementPolicyListQuerySchema,
  channelSettlementRunListQuerySchema,
  channelWebhookEventListQuerySchema,
  insertChannelBookingLinkSchema,
  insertChannelCommissionRuleSchema,
  insertChannelContractSchema,
  insertChannelInventoryAllotmentSchema,
  insertChannelInventoryAllotmentTargetSchema,
  insertChannelInventoryReleaseExecutionSchema,
  insertChannelInventoryReleaseRuleSchema,
  insertChannelProductMappingSchema,
  insertChannelReconciliationItemSchema,
  insertChannelReconciliationPolicySchema,
  insertChannelReconciliationRunSchema,
  insertChannelReleaseScheduleSchema,
  insertChannelRemittanceExceptionSchema,
  insertChannelSchema,
  insertChannelSettlementApprovalSchema,
  insertChannelSettlementItemSchema,
  insertChannelSettlementPolicySchema,
  insertChannelSettlementRunSchema,
  insertChannelWebhookEventSchema,
  updateChannelBookingLinkSchema,
  updateChannelCommissionRuleSchema,
  updateChannelContractSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseExecutionSchema,
  updateChannelInventoryReleaseRuleSchema,
  updateChannelProductMappingSchema,
  updateChannelReconciliationItemSchema,
  updateChannelReconciliationPolicySchema,
  updateChannelReconciliationRunSchema,
  updateChannelReleaseScheduleSchema,
  updateChannelRemittanceExceptionSchema,
  updateChannelSchema,
  updateChannelSettlementApprovalSchema,
  updateChannelSettlementItemSchema,
  updateChannelSettlementPolicySchema,
  updateChannelSettlementRunSchema,
  updateChannelWebhookEventSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const batchIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
})

const createBatchUpdateSchema = <TPatch extends z.ZodTypeAny>(patchSchema: TPatch) =>
  z.object({
    ids: batchIdsSchema.shape.ids,
    patch: patchSchema.refine((value) => Object.keys(value as Record<string, unknown>).length > 0, {
      message: "Patch payload is required",
    }),
  })

const batchUpdateChannelSchema = createBatchUpdateSchema(updateChannelSchema)
const batchUpdateChannelContractSchema = createBatchUpdateSchema(updateChannelContractSchema)
const batchUpdateChannelCommissionRuleSchema = createBatchUpdateSchema(
  updateChannelCommissionRuleSchema,
)
const batchUpdateChannelProductMappingSchema = createBatchUpdateSchema(
  updateChannelProductMappingSchema,
)
const batchUpdateChannelBookingLinkSchema = createBatchUpdateSchema(updateChannelBookingLinkSchema)
const batchUpdateChannelWebhookEventSchema = createBatchUpdateSchema(
  updateChannelWebhookEventSchema,
)
const batchUpdateChannelInventoryAllotmentSchema = createBatchUpdateSchema(
  updateChannelInventoryAllotmentSchema,
)
const batchUpdateChannelInventoryAllotmentTargetSchema = createBatchUpdateSchema(
  updateChannelInventoryAllotmentTargetSchema,
)
const batchUpdateChannelInventoryReleaseRuleSchema = createBatchUpdateSchema(
  updateChannelInventoryReleaseRuleSchema,
)

async function handleBatchUpdate<TPatch, TRow>({
  db,
  ids,
  patch,
  update,
}: {
  db: PostgresJsDatabase
  ids: string[]
  patch: TPatch
  update: (db: PostgresJsDatabase, id: string, patch: TPatch) => Promise<TRow | null>
}) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await update(db, id, patch)
      return row ? { id, row } : { id, row: null }
    }),
  )

  const data = results.flatMap((result) => (result.row ? [result.row] : []))
  const failed = results
    .filter((result) => result.row === null)
    .map((result) => ({ id: result.id, error: "Not found" }))

  return {
    data,
    total: ids.length,
    succeeded: data.length,
    failed,
  }
}

async function handleBatchDelete({
  db,
  ids,
  remove,
}: {
  db: PostgresJsDatabase
  ids: string[]
  remove: (db: PostgresJsDatabase, id: string) => Promise<{ id: string } | null>
}) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await remove(db, id)
      return row ? { id } : { id, error: "Not found" }
    }),
  )

  const deletedIds = results.flatMap((result) => ("error" in result ? [] : [result.id]))
  const failed = results
    .filter((result): result is { id: string; error: string } => "error" in result)
    .map((result) => ({ id: result.id, error: result.error }))

  return {
    deletedIds,
    total: ids.length,
    succeeded: deletedIds.length,
    failed,
  }
}

export const distributionRoutes = new Hono<Env>()
  .get("/channels", async (c) => {
    const query = await parseQuery(c, channelListQuerySchema)
    return c.json(await distributionService.listChannels(c.get("db"), query))
  })
  .post("/channels", async (c) => {
    return c.json(
      {
        data: await distributionService.createChannel(
          c.get("db"),
          await parseJsonBody(c, insertChannelSchema),
        ),
      },
      201,
    )
  })
  .post("/channels/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateChannel.bind(distributionService),
      }),
    )
  })
  .post("/channels/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteChannel,
      }),
    )
  })
  .get("/channels/:id", async (c) => {
    const row = await distributionService.getChannelById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/channels/:id", async (c) => {
    const row = await distributionService.updateChannel(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelSchema),
    )
    if (!row) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/channels/:id", async (c) => {
    const row = await distributionService.deleteChannel(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel not found" }, 404)
    return c.json({ success: true })
  })
  .get("/channels/:id/contact-points", async (c) => {
    const rows = await distributionService.listChannelContactPoints(c.get("db"), c.req.param("id"))
    if (!rows) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: rows })
  })
  .post("/channels/:id/contact-points", async (c) => {
    const row = await distributionService.createChannelContactPoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertContactPointForEntitySchema),
    )
    if (!row) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/channel-contact-points/:contactPointId", async (c) => {
    const row = await distributionService.updateChannelContactPoint(
      c.get("db"),
      c.req.param("contactPointId"),
      await parseJsonBody(c, updateIdentityContactPointSchema),
    )
    if (!row) return c.json({ error: "Channel contact point not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/channel-contact-points/:contactPointId", async (c) => {
    const row = await distributionService.deleteChannelContactPoint(
      c.get("db"),
      c.req.param("contactPointId"),
    )
    if (!row) return c.json({ error: "Channel contact point not found" }, 404)
    return c.json({ success: true })
  })
  .get("/channels/:id/contacts", async (c) => {
    const rows = await distributionService.listChannelContacts(c.get("db"), c.req.param("id"))
    if (!rows) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: rows })
  })
  .post("/channels/:id/contacts", async (c) => {
    const row = await distributionService.createChannelContact(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertNamedContactForEntitySchema),
    )
    if (!row) return c.json({ error: "Channel not found" }, 404)
    return c.json({ data: row }, 201)
  })
  .patch("/channel-contacts/:contactId", async (c) => {
    const row = await distributionService.updateChannelContact(
      c.get("db"),
      c.req.param("contactId"),
      await parseJsonBody(c, updateIdentityNamedContactSchema),
    )
    if (!row) return c.json({ error: "Channel contact not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/channel-contacts/:contactId", async (c) => {
    const row = await distributionService.deleteChannelContact(
      c.get("db"),
      c.req.param("contactId"),
    )
    if (!row) return c.json({ error: "Channel contact not found" }, 404)
    return c.json({ success: true })
  })
  .get("/contracts", async (c) => {
    const query = await parseQuery(c, channelContractListQuerySchema)
    return c.json(await distributionService.listContracts(c.get("db"), query))
  })
  .post("/contracts", async (c) => {
    return c.json(
      {
        data: await distributionService.createContract(
          c.get("db"),
          await parseJsonBody(c, insertChannelContractSchema),
        ),
      },
      201,
    )
  })
  .post("/contracts/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelContractSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateContract,
      }),
    )
  })
  .post("/contracts/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteContract,
      }),
    )
  })
  .get("/contracts/:id", async (c) => {
    const row = await distributionService.getContractById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel contract not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/contracts/:id", async (c) => {
    const row = await distributionService.updateContract(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelContractSchema),
    )
    if (!row) return c.json({ error: "Channel contract not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/contracts/:id", async (c) => {
    const row = await distributionService.deleteContract(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel contract not found" }, 404)
    return c.json({ success: true })
  })
  .get("/commission-rules", async (c) => {
    const query = await parseQuery(c, channelCommissionRuleListQuerySchema)
    return c.json(await distributionService.listCommissionRules(c.get("db"), query))
  })
  .post("/commission-rules", async (c) => {
    return c.json(
      {
        data: await distributionService.createCommissionRule(
          c.get("db"),
          await parseJsonBody(c, insertChannelCommissionRuleSchema),
        ),
      },
      201,
    )
  })
  .post("/commission-rules/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelCommissionRuleSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateCommissionRule,
      }),
    )
  })
  .post("/commission-rules/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteCommissionRule,
      }),
    )
  })
  .get("/commission-rules/:id", async (c) => {
    const row = await distributionService.getCommissionRuleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel commission rule not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/commission-rules/:id", async (c) => {
    const row = await distributionService.updateCommissionRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelCommissionRuleSchema),
    )
    if (!row) return c.json({ error: "Channel commission rule not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/commission-rules/:id", async (c) => {
    const row = await distributionService.deleteCommissionRule(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel commission rule not found" }, 404)
    return c.json({ success: true })
  })
  .get("/product-mappings", async (c) => {
    const query = await parseQuery(c, channelProductMappingListQuerySchema)
    return c.json(await distributionService.listProductMappings(c.get("db"), query))
  })
  .post("/product-mappings", async (c) => {
    return c.json(
      {
        data: await distributionService.createProductMapping(
          c.get("db"),
          await parseJsonBody(c, insertChannelProductMappingSchema),
        ),
      },
      201,
    )
  })
  .post("/product-mappings/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelProductMappingSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateProductMapping,
      }),
    )
  })
  .post("/product-mappings/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteProductMapping,
      }),
    )
  })
  .get("/product-mappings/:id", async (c) => {
    const row = await distributionService.getProductMappingById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel product mapping not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/product-mappings/:id", async (c) => {
    const row = await distributionService.updateProductMapping(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelProductMappingSchema),
    )
    if (!row) return c.json({ error: "Channel product mapping not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/product-mappings/:id", async (c) => {
    const row = await distributionService.deleteProductMapping(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel product mapping not found" }, 404)
    return c.json({ success: true })
  })
  .get("/booking-links", async (c) => {
    const query = await parseQuery(c, channelBookingLinkListQuerySchema)
    return c.json(await distributionService.listBookingLinks(c.get("db"), query))
  })
  .post("/booking-links", async (c) => {
    return c.json(
      {
        data: await distributionService.createBookingLink(
          c.get("db"),
          await parseJsonBody(c, insertChannelBookingLinkSchema),
        ),
      },
      201,
    )
  })
  .post("/booking-links/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelBookingLinkSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateBookingLink,
      }),
    )
  })
  .post("/booking-links/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteBookingLink,
      }),
    )
  })
  .get("/booking-links/:id", async (c) => {
    const row = await distributionService.getBookingLinkById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel booking link not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/booking-links/:id", async (c) => {
    const row = await distributionService.updateBookingLink(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelBookingLinkSchema),
    )
    if (!row) return c.json({ error: "Channel booking link not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/booking-links/:id", async (c) => {
    const row = await distributionService.deleteBookingLink(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel booking link not found" }, 404)
    return c.json({ success: true })
  })
  .get("/webhook-events", async (c) => {
    const query = await parseQuery(c, channelWebhookEventListQuerySchema)
    return c.json(await distributionService.listWebhookEvents(c.get("db"), query))
  })
  .post("/webhook-events", async (c) => {
    return c.json(
      {
        data: await distributionService.createWebhookEvent(
          c.get("db"),
          await parseJsonBody(c, insertChannelWebhookEventSchema),
        ),
      },
      201,
    )
  })
  .post("/webhook-events/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateChannelWebhookEventSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: distributionService.updateWebhookEvent,
      }),
    )
  })
  .post("/webhook-events/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: distributionService.deleteWebhookEvent,
      }),
    )
  })
  .get("/webhook-events/:id", async (c) => {
    const row = await distributionService.getWebhookEventById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel webhook event not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/webhook-events/:id", async (c) => {
    const row = await distributionService.updateWebhookEvent(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateChannelWebhookEventSchema),
    )
    if (!row) return c.json({ error: "Channel webhook event not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/webhook-events/:id", async (c) => {
    const row = await distributionService.deleteWebhookEvent(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Channel webhook event not found" }, 404)
    return c.json({ success: true })
  })
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

export type DistributionRoutes = typeof distributionRoutes
