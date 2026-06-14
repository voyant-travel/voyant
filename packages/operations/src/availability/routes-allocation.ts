import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"

import type { Env } from "./routes-shared.js"
import {
  AllocationServiceError,
  assignTravelerAllocation,
  createAllocationResource,
  deleteAllocationResource,
  deleteSharingGroupLabel,
  getSlotAllocationManifest,
  listAllocationAuditLog,
  pairSharingGroup,
  updateAllocationResource,
  updateSharingGroupLabel,
  updateTravelerSharingGroup,
} from "./service-allocation.js"
import {
  autoAllocateSlotResources,
  autoMaterializeAllocationResources,
  deleteProductOptionResourceTemplate,
  listProductOptionResourceTemplates,
  materializeOpenSlotsFromTemplateDefaults,
  materializeSlotResourcesFromTemplateDefaults,
  upsertProductOptionResourceTemplate,
} from "./service-allocation-automation.js"
import {
  allocationExportFilename,
  buildAllocationPassengersCsv,
  buildAllocationRoomingCsv,
} from "./service-allocation-exports.js"
import {
  allocationAuditLogQuerySchema,
  allocationAutomationSchema,
  assignTravelerAllocationSchema,
  insertAllocationResourceSchema,
  materializeOpenSlotsSchema,
  pairSharingGroupSchema,
  updateAllocationResourceSchema,
  updateSharingGroupLabelSchema,
  updateTravelerSharingGroupSchema,
  upsertResourceTemplateSchema,
} from "./validation.js"

export const availabilityAllocationRoutes = new Hono<Env>()
  .get("/slots/:id/allocation", async (c) => {
    const manifest = await getSlotAllocationManifest(c.get("db"), c.req.param("id"))
    return manifest
      ? c.json({ data: manifest })
      : c.json({ error: "Availability slot not found" }, 404)
  })
  .post("/slots/:id/allocation/resources", async (c) => {
    const row = await createAllocationResource(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertAllocationResourceSchema),
      { actorId: c.get("userId") ?? null },
    )
    return row ? c.json({ data: row }, 201) : c.json({ error: "Availability slot not found" }, 404)
  })
  .patch("/slots/:id/allocation/resources/:resourceId", async (c) => {
    try {
      const row = await updateAllocationResource(
        c.get("db"),
        c.req.param("id"),
        c.req.param("resourceId"),
        await parseJsonBody(c, updateAllocationResourceSchema),
        { actorId: c.get("userId") ?? null },
      )
      return row ? c.json({ data: row }) : c.json({ error: "Allocation resource not found" }, 404)
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .delete("/slots/:id/allocation/resources/:resourceId", async (c) => {
    const row = await deleteAllocationResource(
      c.get("db"),
      c.req.param("id"),
      c.req.param("resourceId"),
      { actorId: c.get("userId") ?? null },
    )
    return row ? c.json({ data: row }) : c.json({ error: "Allocation resource not found" }, 404)
  })
  .patch("/slots/:id/allocation/travelers/:travelerId", async (c) => {
    try {
      const result = await assignTravelerAllocation(
        c.get("db"),
        c.req.param("id"),
        c.req.param("travelerId"),
        await parseJsonBody(c, assignTravelerAllocationSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data: result })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .patch("/slots/:id/allocation/travelers/:travelerId/sharing-group", async (c) => {
    try {
      const result = await updateTravelerSharingGroup(
        c.get("db"),
        c.req.param("id"),
        c.req.param("travelerId"),
        await parseJsonBody(c, updateTravelerSharingGroupSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data: result })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .post("/slots/:id/allocation/sharing-groups/pair", async (c) => {
    try {
      const result = await pairSharingGroup(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, pairSharingGroupSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data: result }, 201)
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .get("/products/:productId/allocation/resource-templates", async (c) => {
    const data = await listProductOptionResourceTemplates(c.get("db"), c.req.param("productId"))
    return c.json({ data })
  })
  .put("/products/:productId/options/:optionId/allocation/resource-templates/:kind", async (c) => {
    try {
      const data = await upsertProductOptionResourceTemplate(
        c.get("db"),
        c.req.param("productId"),
        c.req.param("optionId"),
        c.req.param("kind"),
        await parseJsonBody(c, upsertResourceTemplateSchema),
      )
      return c.json({ data })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .delete(
    "/products/:productId/options/:optionId/allocation/resource-templates/:kind",
    async (c) => {
      try {
        const data = await deleteProductOptionResourceTemplate(
          c.get("db"),
          c.req.param("productId"),
          c.req.param("optionId"),
          c.req.param("kind"),
          c.req.query("refId") ?? null,
        )
        return data ? c.json({ data }) : c.json({ error: "Resource template not found" }, 404)
      } catch (error) {
        return handleAllocationRouteError(c, error)
      }
    },
  )
  .post("/slots/:id/allocation/auto-materialize", async (c) => {
    try {
      const data = await autoMaterializeAllocationResources(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, allocationAutomationSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .post("/products/:id/allocation/materialize-open-slots", async (c) => {
    try {
      const body = await parseJsonBody(c, materializeOpenSlotsSchema)
      const data = await materializeOpenSlotsFromTemplateDefaults(c.get("db"), {
        productId: c.req.param("id"),
        optionId: body.optionId,
      })
      return c.json({ data })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  // Materialize the slot's FULL configured inventory (every template's
  // default_count across all kinds), distinct from the pax-derived
  // auto-materialize. Used by the slot UI's "Generate resources".
  .post("/slots/:id/allocation/materialize-templates", async (c) => {
    try {
      const result = await materializeSlotResourcesFromTemplateDefaults(
        c.get("db"),
        c.req.param("id"),
      )
      return c.json({ data: { created: result.created } })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .post("/slots/:id/allocation/auto-allocate", async (c) => {
    try {
      const data = await autoAllocateSlotResources(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, allocationAutomationSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .put("/slots/:id/allocation/sharing-groups/:groupId/label", async (c) => {
    try {
      const data = await updateSharingGroupLabel(
        c.get("db"),
        c.req.param("id"),
        c.req.param("groupId"),
        await parseJsonBody(c, updateSharingGroupLabelSchema),
        { actorId: c.get("userId") ?? null },
      )
      return c.json({ data })
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .delete("/slots/:id/allocation/sharing-groups/:groupId/label", async (c) => {
    try {
      const data = await deleteSharingGroupLabel(
        c.get("db"),
        c.req.param("id"),
        c.req.param("groupId"),
        { actorId: c.get("userId") ?? null },
      )
      return data ? c.json({ data }) : c.json({ error: "Sharing group label not found" }, 404)
    } catch (error) {
      return handleAllocationRouteError(c, error)
    }
  })
  .get("/slots/:id/allocation/audit-log", async (c) => {
    const query = await parseQuery(c, allocationAuditLogQuerySchema)
    const data = await listAllocationAuditLog(c.get("db"), c.req.param("id"), query.limit)
    return c.json({ data })
  })
  .get("/slots/:id/allocation/export-passengers", async (c) => {
    const manifest = await getSlotAllocationManifest(c.get("db"), c.req.param("id"))
    if (!manifest) return c.json({ error: "Availability slot not found" }, 404)
    return csvResponse(
      buildAllocationPassengersCsv(manifest),
      allocationExportFilename(manifest, "passengers"),
    )
  })
  .get("/slots/:id/allocation/export-rooming-list", async (c) => {
    const manifest = await getSlotAllocationManifest(c.get("db"), c.req.param("id"))
    if (!manifest) return c.json({ error: "Availability slot not found" }, 404)
    return csvResponse(
      buildAllocationRoomingCsv(manifest),
      allocationExportFilename(manifest, "rooming"),
    )
  })

function handleAllocationRouteError(c: Context<Env>, error: unknown): Response {
  if (error instanceof AllocationServiceError) {
    return c.json(
      {
        error: error.message,
        ...(error.detail ? { detail: error.detail } : {}),
      },
      error.status as 400 | 404 | 409 | 500,
    )
  }
  throw error
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
