import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { OVERLAY_DEFAULT_SCOPE } from "@voyant-travel/catalog/overlay/schema"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { Context } from "hono"

import {
  clearProductEditorialOverlay,
  listProductEditorialOverlayHistory,
  OverlayVersionConflictError,
  readProductEditorialOverlayState,
  writeProductEditorialOverlay,
} from "./service-editorial-overlays.js"

const audienceSchema = z.enum(["staff", "customer", "partner", "supplier", "default"])

const targetSchema = z.object({
  nodeKind: z.enum(["root", "itinerary-day"]).optional(),
  nodeKey: z.string().optional(),
  fieldPath: z.string(),
})

const scopeQuerySchema = z.object({
  locale: z.string().default("en-GB"),
  audience: audienceSchema.default("customer"),
  market: z.string().default(OVERLAY_DEFAULT_SCOPE),
})

const targetQuerySchema = scopeQuerySchema.extend({
  nodeKind: z.enum(["root", "itinerary-day"]).optional(),
  nodeKey: z.string().optional(),
  fieldPath: z.string(),
  expectedVersion: z.coerce.number().int().optional(),
})

const writeOverlayBodySchema = targetSchema.extend({
  locale: z.string().default("en-GB"),
  audience: audienceSchema.default("customer"),
  market: z.string().default(OVERLAY_DEFAULT_SCOPE),
  value: z.unknown(),
  expectedVersion: z.number().int().nullable().optional(),
  editorialNote: z.string().optional(),
})

const errorSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
  currentVersion: z.number().int().nullable().optional(),
})

const readEditorialOverlayRoute = createRoute({
  method: "get",
  path: "/{id}/editorial-overlays",
  request: { params: z.object({ id: z.string() }), query: scopeQuerySchema },
  responses: {
    200: {
      description: "Provider source, active overlays, and effective product content",
      content: { "application/json": { schema: z.object({ data: z.unknown() }) } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
})

const writeEditorialOverlayRoute = createRoute({
  method: "put",
  path: "/{id}/editorial-overlays",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: writeOverlayBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Editorial overlay written",
      content: { "application/json": { schema: z.object({ data: z.unknown() }) } },
    },
    400: {
      description: "Invalid overlay target or value",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Overlay version conflict",
      content: { "application/json": { schema: errorSchema } },
    },
  },
})

const clearEditorialOverlayRoute = createRoute({
  method: "delete",
  path: "/{id}/editorial-overlays",
  request: { params: z.object({ id: z.string() }), query: targetQuerySchema },
  responses: {
    200: {
      description: "Editorial overlay cleared",
      content: { "application/json": { schema: z.object({ data: z.unknown() }) } },
    },
    409: {
      description: "Overlay version conflict",
      content: { "application/json": { schema: errorSchema } },
    },
  },
})

const overlayHistoryRoute = createRoute({
  method: "get",
  path: "/{id}/editorial-overlays/history",
  request: { params: z.object({ id: z.string() }), query: targetQuerySchema.partial() },
  responses: {
    200: {
      description: "Editorial overlay audit history",
      content: { "application/json": { schema: z.object({ data: z.array(z.unknown()) }) } },
    },
  },
})

export interface ProductEditorialOverlayRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
    userId?: string
  }
}

export interface CreateProductEditorialOverlayRoutesOptions {
  resolveRegistry: (c: Context) => SourceAdapterRegistry
}

export function createProductEditorialOverlayRoutes(
  options: CreateProductEditorialOverlayRoutesOptions,
): OpenAPIHono<ProductEditorialOverlayRoutesEnv> {
  return new OpenAPIHono<ProductEditorialOverlayRoutesEnv>({ defaultHook: openApiValidationHook })
    .openapi(readEditorialOverlayRoute, async (c) => {
      const query = c.req.valid("query")
      const data = await readProductEditorialOverlayState(
        c.var.db,
        c.req.valid("param").id,
        {
          preferredLocales: [query.locale],
          market: query.market,
          acceptMachineTranslated: false,
        },
        { registry: options.resolveRegistry(c) },
        { audience: query.audience },
      )
      if (!data) {
        return c.json({ error: "not_found", detail: "Product not found" }, 404)
      }
      return c.json({ data }, 200)
    })
    .openapi(writeEditorialOverlayRoute, async (c) => {
      const body = c.req.valid("json")
      try {
        const row = await writeProductEditorialOverlay(
          c.var.db,
          c.req.valid("param").id,
          {
            node_kind: body.nodeKind,
            node_key: body.nodeKey,
            field_path: body.fieldPath,
            scope: {
              locale: body.locale,
              audience: body.audience,
              market: body.market,
            },
            value: body.value,
            expected_version: body.expectedVersion,
            editorial_note: body.editorialNote,
            origin: { kind: "admin-ui", user_id: c.var.userId ?? "system" },
          },
          { registry: options.resolveRegistry(c) },
        )
        return c.json({ data: row }, 200)
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json(
            {
              error: "version_conflict",
              detail: err.message,
              currentVersion: err.currentVersion,
            },
            409,
          )
        }
        return c.json({ error: "invalid_editorial_overlay", detail: errorMessage(err) }, 400)
      }
    })
    .openapi(clearEditorialOverlayRoute, async (c) => {
      const query = c.req.valid("query")
      try {
        const row = await clearProductEditorialOverlay(c.var.db, c.req.valid("param").id, {
          node_kind: query.nodeKind,
          node_key: query.nodeKey,
          field_path: query.fieldPath,
          scope: {
            locale: query.locale,
            audience: query.audience,
            market: query.market,
          },
          expected_version: query.expectedVersion,
        })
        return c.json({ data: { cleared: row != null, overlay: row } }, 200)
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json(
            {
              error: "version_conflict",
              detail: err.message,
              currentVersion: err.currentVersion,
            },
            409,
          )
        }
        throw err
      }
    })
    .openapi(overlayHistoryRoute, async (c) => {
      const query = c.req.valid("query")
      const rows = await listProductEditorialOverlayHistory(c.var.db, c.req.valid("param").id, {
        node_kind: query.nodeKind,
        node_key: query.nodeKey,
        field_path: query.fieldPath,
        locale: query.locale,
        audience: query.audience,
        market: query.market,
      })
      return c.json({ data: rows }, 200)
    })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
