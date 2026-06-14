import {
  aggregateSnapshotKey,
  readThroughAggregateSnapshot,
} from "@voyant-travel/db/aggregate-snapshots"
import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import {
  batchIdsSchema,
  createBatchUpdateSchema,
  type Env,
  handleBatchDelete,
  handleBatchUpdate,
  notFound,
} from "./routes-shared.js"
import { availabilityService } from "./service.js"
import {
  availabilityAggregatesQuerySchema,
  availabilityCloseoutListQuerySchema,
  availabilityOverviewQuerySchema,
  availabilityRuleListQuerySchema,
  availabilitySlotListQuerySchema,
  availabilityStartTimeListQuerySchema,
  insertAvailabilityCloseoutSchema,
  insertAvailabilityRuleSchema,
  insertAvailabilitySlotSchema,
  insertAvailabilityStartTimeSchema,
  updateAvailabilityCloseoutSchema,
  updateAvailabilityRuleSchema,
  updateAvailabilitySlotSchema,
  updateAvailabilityStartTimeSchema,
} from "./validation.js"

const batchUpdateAvailabilityRuleSchema = createBatchUpdateSchema(updateAvailabilityRuleSchema)
const batchUpdateAvailabilityStartTimeSchema = createBatchUpdateSchema(
  updateAvailabilityStartTimeSchema,
)
const batchUpdateAvailabilitySlotSchema = createBatchUpdateSchema(updateAvailabilitySlotSchema)
const batchUpdateAvailabilityCloseoutSchema = createBatchUpdateSchema(
  updateAvailabilityCloseoutSchema,
)

const DASHBOARD_AGGREGATES_CACHE_CONTROL = "private, max-age=30"

/** Server-side snapshot TTL — see readThroughAggregateSnapshot (#1629). */
const DASHBOARD_AGGREGATES_TTL_SECONDS = 60

function cacheDashboardAggregates(c: {
  header: (name: string, value: string, options?: { append?: boolean }) => void
}) {
  c.header("Cache-Control", DASHBOARD_AGGREGATES_CACHE_CONTROL)
  c.header("Vary", "Authorization", { append: true })
  c.header("Vary", "Cookie", { append: true })
}

export const availabilityCoreRoutes = new Hono<Env>()
  // GET /aggregates — dashboard KPIs, served from a read-through TTL
  // snapshot (#1629).
  .get("/aggregates", async (c) => {
    const query = await parseQuery(c, availabilityAggregatesQuerySchema)
    cacheDashboardAggregates(c)
    const snapshot = await readThroughAggregateSnapshot(c.get("db"), {
      key: aggregateSnapshotKey("availability", "aggregates", query),
      ttlSeconds: DASHBOARD_AGGREGATES_TTL_SECONDS,
      compute: () => availabilityService.getAvailabilityAggregates(c.get("db"), query),
    })
    return c.json({ data: snapshot.data })
  })
  .get("/overview", async (c) => {
    const query = await parseQuery(c, availabilityOverviewQuerySchema)
    return c.json({
      data: await availabilityService.getAvailabilityOverview(c.get("db"), query),
    })
  })
  .get("/rules", async (c) => {
    const query = await parseQuery(c, availabilityRuleListQuerySchema)
    return c.json(await availabilityService.listRules(c.get("db"), query))
  })
  .post("/rules", async (c) =>
    c.json(
      {
        data: await availabilityService.createRule(
          c.get("db"),
          await parseJsonBody(c, insertAvailabilityRuleSchema),
        ),
      },
      201,
    ),
  )
  .post("/rules/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateAvailabilityRuleSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateRule,
      }),
    )
  })
  .post("/rules/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteRule,
      }),
    )
  })
  .get("/rules/:id", async (c) => {
    const row = await availabilityService.getRuleById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Availability rule not found")
  })
  .patch("/rules/:id", async (c) => {
    const row = await availabilityService.updateRule(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAvailabilityRuleSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Availability rule not found")
  })
  .delete("/rules/:id", async (c) => {
    const row = await availabilityService.deleteRule(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Availability rule not found")
  })
  .get("/start-times", async (c) => {
    const query = await parseQuery(c, availabilityStartTimeListQuerySchema)
    return c.json(await availabilityService.listStartTimes(c.get("db"), query))
  })
  .post("/start-times", async (c) =>
    c.json(
      {
        data: await availabilityService.createStartTime(
          c.get("db"),
          await parseJsonBody(c, insertAvailabilityStartTimeSchema),
        ),
      },
      201,
    ),
  )
  .post("/start-times/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateAvailabilityStartTimeSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateStartTime,
      }),
    )
  })
  .post("/start-times/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteStartTime,
      }),
    )
  })
  .get("/start-times/:id", async (c) => {
    const row = await availabilityService.getStartTimeById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Availability start time not found")
  })
  .patch("/start-times/:id", async (c) => {
    const row = await availabilityService.updateStartTime(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAvailabilityStartTimeSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Availability start time not found")
  })
  .delete("/start-times/:id", async (c) => {
    const row = await availabilityService.deleteStartTime(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Availability start time not found")
  })
  .get("/slots", async (c) => {
    const query = await parseQuery(c, availabilitySlotListQuerySchema)
    return c.json(await availabilityService.listSlots(c.get("db"), query))
  })
  .post("/slots", async (c) =>
    c.json(
      {
        data: await availabilityService.createSlot(
          c.get("db"),
          await parseJsonBody(c, insertAvailabilitySlotSchema),
          { eventBus: c.get("eventBus") },
        ),
      },
      201,
    ),
  )
  .post("/slots/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateAvailabilitySlotSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateSlot,
      }),
    )
  })
  .post("/slots/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteSlot,
      }),
    )
  })
  .get("/slots/:id", async (c) => {
    const row = await availabilityService.getSlotById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Availability slot not found")
  })
  .get("/slots/:id/unit-availability", async (c) => {
    const rows = await availabilityService.getSlotUnitAvailability(c.get("db"), c.req.param("id"))
    return rows ? c.json({ data: rows }) : notFound(c, "Availability slot not found")
  })
  .patch("/slots/:id", async (c) => {
    const row = await availabilityService.updateSlot(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAvailabilitySlotSchema),
      { eventBus: c.get("eventBus"), source: "manual" },
    )
    return row ? c.json({ data: row }) : notFound(c, "Availability slot not found")
  })
  .delete("/slots/:id", async (c) => {
    const row = await availabilityService.deleteSlot(c.get("db"), c.req.param("id"), {
      eventBus: c.get("eventBus"),
    })
    return row ? c.json({ success: true }) : notFound(c, "Availability slot not found")
  })
  .get("/closeouts", async (c) => {
    const query = await parseQuery(c, availabilityCloseoutListQuerySchema)
    return c.json(await availabilityService.listCloseouts(c.get("db"), query))
  })
  .post("/closeouts", async (c) =>
    c.json(
      {
        data: await availabilityService.createCloseout(
          c.get("db"),
          await parseJsonBody(c, insertAvailabilityCloseoutSchema),
        ),
      },
      201,
    ),
  )
  .post("/closeouts/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateAvailabilityCloseoutSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: availabilityService.updateCloseout,
      }),
    )
  })
  .post("/closeouts/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: availabilityService.deleteCloseout,
      }),
    )
  })
  .get("/closeouts/:id", async (c) => {
    const row = await availabilityService.getCloseoutById(c.get("db"), c.req.param("id"))
    return row ? c.json({ data: row }) : notFound(c, "Availability closeout not found")
  })
  .patch("/closeouts/:id", async (c) => {
    const row = await availabilityService.updateCloseout(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateAvailabilityCloseoutSchema),
    )
    return row ? c.json({ data: row }) : notFound(c, "Availability closeout not found")
  })
  .delete("/closeouts/:id", async (c) => {
    const row = await availabilityService.deleteCloseout(c.get("db"), c.req.param("id"))
    return row ? c.json({ success: true }) : notFound(c, "Availability closeout not found")
  })
