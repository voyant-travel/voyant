import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import {
  insertContactPointForEntitySchema,
  insertNamedContactForEntitySchema,
  updateContactPointSchema as updateIdentityContactPointSchema,
  updateNamedContactSchema as updateIdentityNamedContactSchema,
} from "@voyant-travel/identity/validation"
import { Hono } from "hono"
import {
  batchIdsSchema,
  batchUpdateChannelBookingLinkSchema,
  batchUpdateChannelCommissionRuleSchema,
  batchUpdateChannelContractSchema,
  batchUpdateChannelProductMappingSchema,
  batchUpdateChannelSchema,
  batchUpdateChannelWebhookEventSchema,
  handleBatchDelete,
  handleBatchUpdate,
} from "./routes/batch.js"
import type { DistributionRouteEnv } from "./routes/env.js"
import { inventoryRoutes } from "./routes/inventory.js"
import { settlementRoutes } from "./routes/settlements.js"
import { distributionService } from "./service.js"
import {
  channelBookingLinkListQuerySchema,
  channelCommissionRuleListQuerySchema,
  channelContractListQuerySchema,
  channelListQuerySchema,
  channelProductMappingListQuerySchema,
  channelWebhookEventListQuerySchema,
  insertChannelBookingLinkSchema,
  insertChannelCommissionRuleSchema,
  insertChannelContractSchema,
  insertChannelProductMappingSchema,
  insertChannelSchema,
  insertChannelWebhookEventSchema,
  updateChannelBookingLinkSchema,
  updateChannelCommissionRuleSchema,
  updateChannelContractSchema,
  updateChannelProductMappingSchema,
  updateChannelSchema,
  updateChannelWebhookEventSchema,
} from "./validation.js"

export const distributionRoutes = new Hono<DistributionRouteEnv>()
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
  .route("/", inventoryRoutes)
  .route("/", settlementRoutes)

export type DistributionRoutes = typeof distributionRoutes
