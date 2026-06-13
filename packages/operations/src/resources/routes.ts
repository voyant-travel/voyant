import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import { resourcesService } from "./service.js"
import {
  insertResourceCloseoutSchema,
  insertResourcePoolMemberSchema,
  insertResourcePoolSchema,
  insertResourceRequirementSchema,
  insertResourceSchema,
  insertResourceSlotAssignmentSchema,
  resourceCloseoutListQuerySchema,
  resourceListQuerySchema,
  resourcePoolListQuerySchema,
  resourcePoolMemberListQuerySchema,
  resourceRequirementListQuerySchema,
  resourceSlotAssignmentListQuerySchema,
  updateResourceCloseoutSchema,
  updateResourcePoolSchema,
  updateResourceRequirementSchema,
  updateResourceSchema,
  updateResourceSlotAssignmentSchema,
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

const batchUpdateResourceSchema = createBatchUpdateSchema(updateResourceSchema)
const batchUpdateResourcePoolSchema = createBatchUpdateSchema(updateResourcePoolSchema)
const batchUpdateResourceRequirementSchema = createBatchUpdateSchema(
  updateResourceRequirementSchema,
)
const batchUpdateResourceSlotAssignmentSchema = createBatchUpdateSchema(
  updateResourceSlotAssignmentSchema,
)
const batchUpdateResourceCloseoutSchema = createBatchUpdateSchema(updateResourceCloseoutSchema)

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
  const results: Array<{ id: string; row: TRow | null }> = []
  for (const id of ids) {
    const row = await update(db, id, patch)
    results.push({ id, row })
  }

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
  const results: Array<{ id: string } | { id: string; error: string }> = []
  for (const id of ids) {
    const row = await remove(db, id)
    results.push(row ? { id } : { id, error: "Not found" })
  }

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

export const resourcesRoutes = new Hono<Env>()
  .get("/resources", async (c) => {
    const query = await parseQuery(c, resourceListQuerySchema)
    return c.json(await resourcesService.listResources(c.get("db"), query))
  })
  .post("/resources", async (c) => {
    return c.json(
      {
        data: await resourcesService.createResource(
          c.get("db"),
          await parseJsonBody(c, insertResourceSchema),
        ),
      },
      201,
    )
  })
  .post("/resources/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourceSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateResource,
      }),
    )
  })
  .post("/resources/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteResource,
      }),
    )
  })
  .get("/resources/:id", async (c) => {
    const row = await resourcesService.getResourceById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/resources/:id", async (c) => {
    const row = await resourcesService.updateResource(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourceSchema),
    )
    if (!row) return c.json({ error: "Resource not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/resources/:id", async (c) => {
    const row = await resourcesService.deleteResource(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource not found" }, 404)
    return c.json({ success: true })
  })
  .get("/pools", async (c) => {
    const query = await parseQuery(c, resourcePoolListQuerySchema)
    return c.json(await resourcesService.listPools(c.get("db"), query))
  })
  .post("/pools", async (c) => {
    return c.json(
      {
        data: await resourcesService.createPool(
          c.get("db"),
          await parseJsonBody(c, insertResourcePoolSchema),
        ),
      },
      201,
    )
  })
  .post("/pools/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourcePoolSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updatePool,
      }),
    )
  })
  .post("/pools/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deletePool,
      }),
    )
  })
  .get("/pools/:id", async (c) => {
    const row = await resourcesService.getPoolById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource pool not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/pools/:id", async (c) => {
    const row = await resourcesService.updatePool(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourcePoolSchema),
    )
    if (!row) return c.json({ error: "Resource pool not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/pools/:id", async (c) => {
    const row = await resourcesService.deletePool(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource pool not found" }, 404)
    return c.json({ success: true })
  })
  .get("/pool-members", async (c) => {
    const query = await parseQuery(c, resourcePoolMemberListQuerySchema)
    return c.json(await resourcesService.listPoolMembers(c.get("db"), query))
  })
  .post("/pool-members", async (c) => {
    return c.json(
      {
        data: await resourcesService.createPoolMember(
          c.get("db"),
          await parseJsonBody(c, insertResourcePoolMemberSchema),
        ),
      },
      201,
    )
  })
  .delete("/pool-members/:id", async (c) => {
    const row = await resourcesService.deletePoolMember(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource pool member not found" }, 404)
    return c.json({ success: true })
  })
  .get("/requirements", async (c) => {
    const query = await parseQuery(c, resourceRequirementListQuerySchema)
    return c.json(await resourcesService.listRequirements(c.get("db"), query))
  })
  .post("/requirements", async (c) => {
    return c.json(
      {
        data: await resourcesService.createRequirement(
          c.get("db"),
          await parseJsonBody(c, insertResourceRequirementSchema),
        ),
      },
      201,
    )
  })
  .post("/requirements/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourceRequirementSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateRequirement,
      }),
    )
  })
  .post("/requirements/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteRequirement,
      }),
    )
  })
  .get("/requirements/:id", async (c) => {
    const row = await resourcesService.getRequirementById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource requirement not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/requirements/:id", async (c) => {
    const row = await resourcesService.updateRequirement(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourceRequirementSchema),
    )
    if (!row) return c.json({ error: "Resource requirement not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/requirements/:id", async (c) => {
    const row = await resourcesService.deleteRequirement(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource requirement not found" }, 404)
    return c.json({ success: true })
  })
  .get("/allocations", async (c) => {
    const query = await parseQuery(c, resourceRequirementListQuerySchema)
    return c.json(await resourcesService.listRequirements(c.get("db"), query))
  })
  .post("/allocations", async (c) => {
    return c.json(
      {
        data: await resourcesService.createRequirement(
          c.get("db"),
          await parseJsonBody(c, insertResourceRequirementSchema),
        ),
      },
      201,
    )
  })
  .post("/allocations/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourceRequirementSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateRequirement,
      }),
    )
  })
  .post("/allocations/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteRequirement,
      }),
    )
  })
  .get("/allocations/:id", async (c) => {
    const row = await resourcesService.getRequirementById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource allocation not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/allocations/:id", async (c) => {
    const row = await resourcesService.updateRequirement(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourceRequirementSchema),
    )
    if (!row) return c.json({ error: "Resource allocation not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/allocations/:id", async (c) => {
    const row = await resourcesService.deleteRequirement(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource allocation not found" }, 404)
    return c.json({ success: true })
  })
  .get("/slot-assignments", async (c) => {
    const query = await parseQuery(c, resourceSlotAssignmentListQuerySchema)
    return c.json(await resourcesService.listSlotAssignments(c.get("db"), query))
  })
  .post("/slot-assignments", async (c) => {
    return c.json(
      {
        data: await resourcesService.createSlotAssignment(
          c.get("db"),
          await parseJsonBody(c, insertResourceSlotAssignmentSchema),
        ),
      },
      201,
    )
  })
  .post("/slot-assignments/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourceSlotAssignmentSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateSlotAssignment,
      }),
    )
  })
  .post("/slot-assignments/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteSlotAssignment,
      }),
    )
  })
  .get("/slot-assignments/:id", async (c) => {
    const row = await resourcesService.getSlotAssignmentById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource slot assignment not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/slot-assignments/:id", async (c) => {
    const row = await resourcesService.updateSlotAssignment(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourceSlotAssignmentSchema),
    )
    if (!row) return c.json({ error: "Resource slot assignment not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/slot-assignments/:id", async (c) => {
    const row = await resourcesService.deleteSlotAssignment(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource slot assignment not found" }, 404)
    return c.json({ success: true })
  })
  .get("/closeouts", async (c) => {
    const query = await parseQuery(c, resourceCloseoutListQuerySchema)
    return c.json(await resourcesService.listCloseouts(c.get("db"), query))
  })
  .post("/closeouts", async (c) => {
    return c.json(
      {
        data: await resourcesService.createCloseout(
          c.get("db"),
          await parseJsonBody(c, insertResourceCloseoutSchema),
        ),
      },
      201,
    )
  })
  .post("/closeouts/batch-update", async (c) => {
    const body = await parseJsonBody(c, batchUpdateResourceCloseoutSchema)
    return c.json(
      await handleBatchUpdate({
        db: c.get("db"),
        ids: body.ids,
        patch: body.patch,
        update: resourcesService.updateCloseout,
      }),
    )
  })
  .post("/closeouts/batch-delete", async (c) => {
    const body = await parseJsonBody(c, batchIdsSchema)
    return c.json(
      await handleBatchDelete({
        db: c.get("db"),
        ids: body.ids,
        remove: resourcesService.deleteCloseout,
      }),
    )
  })
  .get("/closeouts/:id", async (c) => {
    const row = await resourcesService.getCloseoutById(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource closeout not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/closeouts/:id", async (c) => {
    const row = await resourcesService.updateCloseout(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateResourceCloseoutSchema),
    )
    if (!row) return c.json({ error: "Resource closeout not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/closeouts/:id", async (c) => {
    const row = await resourcesService.deleteCloseout(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Resource closeout not found" }, 404)
    return c.json({ success: true })
  })

export type ResourcesRoutes = typeof resourcesRoutes
