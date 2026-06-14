import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { groundService } from "./service.js"
import {
  groundDispatchAssignmentListQuerySchema,
  groundDispatchCheckpointListQuerySchema,
  groundDispatchLegListQuerySchema,
  groundDispatchListQuerySchema,
  groundDispatchPassengerListQuerySchema,
  groundDriverListQuerySchema,
  groundDriverShiftListQuerySchema,
  groundExecutionEventListQuerySchema,
  groundOperatorListQuerySchema,
  groundServiceIncidentListQuerySchema,
  groundTransferPreferenceListQuerySchema,
  groundVehicleListQuerySchema,
  insertGroundDispatchAssignmentSchema,
  insertGroundDispatchCheckpointSchema,
  insertGroundDispatchLegSchema,
  insertGroundDispatchPassengerSchema,
  insertGroundDispatchSchema,
  insertGroundDriverSchema,
  insertGroundDriverShiftSchema,
  insertGroundExecutionEventSchema,
  insertGroundOperatorSchema,
  insertGroundServiceIncidentSchema,
  insertGroundTransferPreferenceSchema,
  insertGroundVehicleSchema,
  updateGroundDispatchAssignmentSchema,
  updateGroundDispatchCheckpointSchema,
  updateGroundDispatchLegSchema,
  updateGroundDispatchPassengerSchema,
  updateGroundDispatchSchema,
  updateGroundDriverSchema,
  updateGroundDriverShiftSchema,
  updateGroundExecutionEventSchema,
  updateGroundOperatorSchema,
  updateGroundServiceIncidentSchema,
  updateGroundTransferPreferenceSchema,
  updateGroundVehicleSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const groundRoutes = new Hono<Env>()
  .get("/operators", async (c) => {
    const query = await parseQuery(c, groundOperatorListQuerySchema)
    return c.json(await groundService.listOperators(c.get("db"), query))
  })
  .post("/operators", async (c) => {
    return c.json(
      {
        data: await groundService.createOperator(
          c.get("db"),
          await parseJsonBody(c, insertGroundOperatorSchema),
        ),
      },
      201,
    )
  })
  .get("/operators/:id", async (c) => {
    const row = await groundService.getOperatorById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground operator not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/operators/:id", async (c) => {
    const row = await groundService.updateOperator(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundOperatorSchema),
    )
    if (!row) return c.json({ error: "Ground operator not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/operators/:id", async (c) => {
    const row = await groundService.deleteOperator(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground operator not found" }, 404)
    return c.json({ success: true })
  })
  .get("/vehicles", async (c) => {
    const query = await parseQuery(c, groundVehicleListQuerySchema)
    return c.json(await groundService.listVehicles(c.get("db"), query))
  })
  .post("/vehicles", async (c) => {
    return c.json(
      {
        data: await groundService.createVehicle(
          c.get("db"),
          await parseJsonBody(c, insertGroundVehicleSchema),
        ),
      },
      201,
    )
  })
  .get("/vehicles/:id", async (c) => {
    const row = await groundService.getVehicleById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground vehicle not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/vehicles/:id", async (c) => {
    const row = await groundService.updateVehicle(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundVehicleSchema),
    )
    if (!row) return c.json({ error: "Ground vehicle not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/vehicles/:id", async (c) => {
    const row = await groundService.deleteVehicle(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground vehicle not found" }, 404)
    return c.json({ success: true })
  })
  .get("/drivers", async (c) => {
    const query = await parseQuery(c, groundDriverListQuerySchema)
    return c.json(await groundService.listDrivers(c.get("db"), query))
  })
  .post("/drivers", async (c) => {
    return c.json(
      {
        data: await groundService.createDriver(
          c.get("db"),
          await parseJsonBody(c, insertGroundDriverSchema),
        ),
      },
      201,
    )
  })
  .get("/drivers/:id", async (c) => {
    const row = await groundService.getDriverById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground driver not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/drivers/:id", async (c) => {
    const row = await groundService.updateDriver(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDriverSchema),
    )
    if (!row) return c.json({ error: "Ground driver not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/drivers/:id", async (c) => {
    const row = await groundService.deleteDriver(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground driver not found" }, 404)
    return c.json({ success: true })
  })
  .get("/transfer-preferences", async (c) => {
    const query = await parseQuery(c, groundTransferPreferenceListQuerySchema)
    return c.json(await groundService.listTransferPreferences(c.get("db"), query))
  })
  .post("/transfer-preferences", async (c) => {
    return c.json(
      {
        data: await groundService.createTransferPreference(
          c.get("db"),
          await parseJsonBody(c, insertGroundTransferPreferenceSchema),
        ),
      },
      201,
    )
  })
  .get("/transfer-preferences/:id", async (c) => {
    const row = await groundService.getTransferPreferenceById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground transfer preference not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/transfer-preferences/:id", async (c) => {
    const row = await groundService.updateTransferPreference(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundTransferPreferenceSchema),
    )
    if (!row) return c.json({ error: "Ground transfer preference not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/transfer-preferences/:id", async (c) => {
    const row = await groundService.deleteTransferPreference(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground transfer preference not found" }, 404)
    return c.json({ success: true })
  })
  .get("/dispatches", async (c) => {
    const query = await parseQuery(c, groundDispatchListQuerySchema)
    return c.json(await groundService.listDispatches(c.get("db"), query))
  })
  .post("/dispatches", async (c) => {
    return c.json(
      {
        data: await groundService.createDispatch(
          c.get("db"),
          await parseJsonBody(c, insertGroundDispatchSchema),
        ),
      },
      201,
    )
  })
  .get("/dispatches/:id", async (c) => {
    const row = await groundService.getDispatchById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/dispatches/:id", async (c) => {
    const row = await groundService.updateDispatch(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDispatchSchema),
    )
    if (!row) return c.json({ error: "Ground dispatch not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/dispatches/:id", async (c) => {
    const row = await groundService.deleteDispatch(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch not found" }, 404)
    return c.json({ success: true })
  })
  .get("/execution-events", async (c) => {
    const query = await parseQuery(c, groundExecutionEventListQuerySchema)
    return c.json(await groundService.listExecutionEvents(c.get("db"), query))
  })
  .post("/execution-events", async (c) => {
    return c.json(
      {
        data: await groundService.createExecutionEvent(
          c.get("db"),
          await parseJsonBody(c, insertGroundExecutionEventSchema),
        ),
      },
      201,
    )
  })
  .get("/execution-events/:id", async (c) => {
    const row = await groundService.getExecutionEventById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground execution event not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/execution-events/:id", async (c) => {
    const row = await groundService.updateExecutionEvent(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundExecutionEventSchema),
    )
    if (!row) return c.json({ error: "Ground execution event not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/execution-events/:id", async (c) => {
    const row = await groundService.deleteExecutionEvent(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground execution event not found" }, 404)
    return c.json({ success: true })
  })
  .get("/dispatch-assignments", async (c) => {
    const query = await parseQuery(c, groundDispatchAssignmentListQuerySchema)
    return c.json(await groundService.listDispatchAssignments(c.get("db"), query))
  })
  .post("/dispatch-assignments", async (c) =>
    c.json(
      {
        data: await groundService.createDispatchAssignment(
          c.get("db"),
          await parseJsonBody(c, insertGroundDispatchAssignmentSchema),
        ),
      },
      201,
    ),
  )
  .get("/dispatch-assignments/:id", async (c) => {
    const row = await groundService.getDispatchAssignmentById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch assignment not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/dispatch-assignments/:id", async (c) => {
    const row = await groundService.updateDispatchAssignment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDispatchAssignmentSchema),
    )
    if (!row) return c.json({ error: "Ground dispatch assignment not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/dispatch-assignments/:id", async (c) => {
    const row = await groundService.deleteDispatchAssignment(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch assignment not found" }, 404)
    return c.json({ success: true })
  })
  .get("/dispatch-legs", async (c) => {
    const query = await parseQuery(c, groundDispatchLegListQuerySchema)
    return c.json(await groundService.listDispatchLegs(c.get("db"), query))
  })
  .post("/dispatch-legs", async (c) =>
    c.json(
      {
        data: await groundService.createDispatchLeg(
          c.get("db"),
          await parseJsonBody(c, insertGroundDispatchLegSchema),
        ),
      },
      201,
    ),
  )
  .get("/dispatch-legs/:id", async (c) => {
    const row = await groundService.getDispatchLegById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch leg not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/dispatch-legs/:id", async (c) => {
    const row = await groundService.updateDispatchLeg(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDispatchLegSchema),
    )
    if (!row) return c.json({ error: "Ground dispatch leg not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/dispatch-legs/:id", async (c) => {
    const row = await groundService.deleteDispatchLeg(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch leg not found" }, 404)
    return c.json({ success: true })
  })
  .get("/dispatch-passengers", async (c) => {
    const query = await parseQuery(c, groundDispatchPassengerListQuerySchema)
    return c.json(await groundService.listDispatchPassengers(c.get("db"), query))
  })
  .post("/dispatch-passengers", async (c) =>
    c.json(
      {
        data: await groundService.createDispatchPassenger(
          c.get("db"),
          await parseJsonBody(c, insertGroundDispatchPassengerSchema),
        ),
      },
      201,
    ),
  )
  .get("/dispatch-passengers/:id", async (c) => {
    const row = await groundService.getDispatchPassengerById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch passenger not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/dispatch-passengers/:id", async (c) => {
    const row = await groundService.updateDispatchPassenger(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDispatchPassengerSchema),
    )
    if (!row) return c.json({ error: "Ground dispatch passenger not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/dispatch-passengers/:id", async (c) => {
    const row = await groundService.deleteDispatchPassenger(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch passenger not found" }, 404)
    return c.json({ success: true })
  })
  .get("/driver-shifts", async (c) => {
    const query = await parseQuery(c, groundDriverShiftListQuerySchema)
    return c.json(await groundService.listDriverShifts(c.get("db"), query))
  })
  .post("/driver-shifts", async (c) =>
    c.json(
      {
        data: await groundService.createDriverShift(
          c.get("db"),
          await parseJsonBody(c, insertGroundDriverShiftSchema),
        ),
      },
      201,
    ),
  )
  .get("/driver-shifts/:id", async (c) => {
    const row = await groundService.getDriverShiftById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground driver shift not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/driver-shifts/:id", async (c) => {
    const row = await groundService.updateDriverShift(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDriverShiftSchema),
    )
    if (!row) return c.json({ error: "Ground driver shift not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/driver-shifts/:id", async (c) => {
    const row = await groundService.deleteDriverShift(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground driver shift not found" }, 404)
    return c.json({ success: true })
  })
  .get("/service-incidents", async (c) => {
    const query = await parseQuery(c, groundServiceIncidentListQuerySchema)
    return c.json(await groundService.listServiceIncidents(c.get("db"), query))
  })
  .post("/service-incidents", async (c) =>
    c.json(
      {
        data: await groundService.createServiceIncident(
          c.get("db"),
          await parseJsonBody(c, insertGroundServiceIncidentSchema),
        ),
      },
      201,
    ),
  )
  .get("/service-incidents/:id", async (c) => {
    const row = await groundService.getServiceIncidentById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground service incident not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/service-incidents/:id", async (c) => {
    const row = await groundService.updateServiceIncident(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundServiceIncidentSchema),
    )
    if (!row) return c.json({ error: "Ground service incident not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/service-incidents/:id", async (c) => {
    const row = await groundService.deleteServiceIncident(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground service incident not found" }, 404)
    return c.json({ success: true })
  })
  .get("/dispatch-checkpoints", async (c) => {
    const query = await parseQuery(c, groundDispatchCheckpointListQuerySchema)
    return c.json(await groundService.listDispatchCheckpoints(c.get("db"), query))
  })
  .post("/dispatch-checkpoints", async (c) =>
    c.json(
      {
        data: await groundService.createDispatchCheckpoint(
          c.get("db"),
          await parseJsonBody(c, insertGroundDispatchCheckpointSchema),
        ),
      },
      201,
    ),
  )
  .get("/dispatch-checkpoints/:id", async (c) => {
    const row = await groundService.getDispatchCheckpointById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch checkpoint not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/dispatch-checkpoints/:id", async (c) => {
    const row = await groundService.updateDispatchCheckpoint(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateGroundDispatchCheckpointSchema),
    )
    if (!row) return c.json({ error: "Ground dispatch checkpoint not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/dispatch-checkpoints/:id", async (c) => {
    const row = await groundService.deleteDispatchCheckpoint(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Ground dispatch checkpoint not found" }, 404)
    return c.json({ success: true })
  })

export type GroundRoutes = typeof groundRoutes
