import { type OpenAPIHono, z } from "@hono/zod-openapi"
import { OVERLAY_DEFAULT_SCOPE } from "@voyant-travel/catalog"
import { OverlayVersionConflictError } from "@voyant-travel/catalog/services/overlay"
import { requireUserId } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import { emitCruiseShipOverlayChanged } from "./events.js"
import { parseUnifiedKey } from "./lib/key.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { adapterNotRegistered, invalidKey, resolveExternal } from "./routes-keying.js"
import { createCruisesAdminRoute as createRoute } from "./routes-openapi.js"
import {
  cruiseCabinCategoryRowSchema,
  cruiseCabinRowSchema,
  cruiseDeckRowSchema,
  cruiseShipRowSchema,
  dataEnvelope,
  errorResponseSchema,
} from "./routes-openapi-schemas.js"
import { cruisesService } from "./service.js"
import {
  clearCruiseShipOverlay,
  cruiseShipOverlayInvalidationScope,
  ingestExternalCruiseShip,
  listCruiseShipOverlayHistory,
  readCruiseShipOverlayState,
  readPublicCruiseShipProjection,
  writeCruiseShipOverlay,
} from "./service-presentation-subjects.js"
import {
  insertCabinCategorySchema,
  insertCabinSchema,
  insertDeckSchema,
  insertShipSchema,
  shipListQuerySchema,
  updateCabinCategorySchema,
  updateCabinSchema,
  updateDeckSchema,
  updateShipSchema,
} from "./validation-cabins.js"

const keyParamSchema = z.object({ key: z.string() })
const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })
const jsonContent = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
})

/** Local ship row, or the external `{ source, ... }` envelope for adapter ships. */
const shipDetailDataSchema = z.union([
  cruiseShipRowSchema,
  z.object({
    source: z.literal("external"),
    sourceProvider: z.string(),
    sourceRef: z.unknown(),
    ship: z.unknown(),
  }),
])

const overlayAudienceSchema = z.enum(["staff", "customer", "partner", "supplier", "default"])
const overlayScopeQuerySchema = z.object({
  locale: z.string().trim().min(1).default("en-GB"),
  audience: overlayAudienceSchema.default("customer"),
  market: z.string().trim().min(1).default(OVERLAY_DEFAULT_SCOPE),
})
const publicOverlayScopeQuerySchema = overlayScopeQuerySchema.extend({
  audience: z.enum(["customer", "partner"]).default("customer"),
})
const overlayTargetQuerySchema = overlayScopeQuerySchema.extend({
  fieldPath: z.string().trim().min(1),
  expectedVersion: z.coerce.number().int().optional(),
})
const writeShipOverlayBodySchema = z.object({
  fieldPath: z.string().trim().min(1),
  locale: z.string().trim().min(1).default("en-GB"),
  audience: overlayAudienceSchema.default("customer"),
  market: z.string().trim().min(1).default(OVERLAY_DEFAULT_SCOPE),
  value: z.unknown(),
  expectedVersion: z.number().int().nullable().optional(),
  editorialNote: z.string().optional(),
})

// --- ships ----------------------------------------------------------------

const listShipsRoute = createRoute({
  method: "get",
  path: "/ships",
  request: { query: shipListQuerySchema },
  responses: {
    200: jsonContent("Paginated list of cruise ships", listResponseSchema(cruiseShipRowSchema)),
  },
})

const createShipRoute = createRoute({
  method: "post",
  path: "/ships",
  request: {
    body: { required: true, content: { "application/json": { schema: insertShipSchema } } },
  },
  responses: {
    201: jsonContent("The created ship", dataEnvelope(cruiseShipRowSchema)),
    400: jsonContent("invalid_request: request body failed validation", errorResponseSchema),
  },
})

const getShipRoute = createRoute({
  method: "get",
  path: "/ships/{key}",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "A ship by unified key (local row or external adapter shape)",
      dataEnvelope(shipDetailDataSchema),
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const getShipEffectiveRoute = createRoute({
  method: "get",
  path: "/ships/{key}/effective",
  request: { params: keyParamSchema, query: publicOverlayScopeQuerySchema },
  responses: {
    200: jsonContent("Public effective ship presentation content", dataEnvelope(z.unknown())),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const getShipEditorialOverlayRoute = createRoute({
  method: "get",
  path: "/ships/{key}/editorial-overlays",
  request: { params: keyParamSchema, query: overlayScopeQuerySchema },
  responses: {
    200: jsonContent("Ship source, overlays, and effective content", dataEnvelope(z.unknown())),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const writeShipEditorialOverlayRoute = createRoute({
  method: "put",
  path: "/ships/{key}/editorial-overlays",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: writeShipOverlayBodySchema } },
    },
  },
  responses: {
    200: jsonContent("Ship editorial overlay written", dataEnvelope(z.unknown())),
    400: jsonContent("Invalid overlay field or value", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    409: jsonContent("Overlay version conflict", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const clearShipEditorialOverlayRoute = createRoute({
  method: "delete",
  path: "/ships/{key}/editorial-overlays",
  request: { params: keyParamSchema, query: overlayTargetQuerySchema },
  responses: {
    200: jsonContent("Ship editorial overlay cleared", dataEnvelope(z.unknown())),
    400: jsonContent("Key is not valid", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    409: jsonContent("Overlay version conflict", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const shipEditorialOverlayHistoryRoute = createRoute({
  method: "get",
  path: "/ships/{key}/editorial-overlays/history",
  request: { params: keyParamSchema, query: overlayTargetQuerySchema.partial() },
  responses: {
    200: jsonContent("Ship editorial overlay history", dataEnvelope(z.array(z.unknown()))),
    400: jsonContent("Key is not valid", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const updateShipRoute = createRoute({
  method: "put",
  path: "/ships/{key}",
  request: {
    params: keyParamSchema,
    body: { required: true, content: { "application/json": { schema: updateShipSchema } } },
  },
  responses: {
    200: jsonContent("The updated ship", dataEnvelope(cruiseShipRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Ship not found", errorResponseSchema),
    409: jsonContent("External cruise/ship is read-only", errorResponseSchema),
  },
})

const listShipDecksRoute = createRoute({
  method: "get",
  path: "/ships/{key}/decks",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "Decks for the ship (local rows or external adapter decks)",
      arrayEnvelope(z.unknown()),
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const createShipDeckRoute = createRoute({
  method: "post",
  path: "/ships/{key}/decks",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: insertDeckSchema.omit({ shipId: true }) } },
    },
  },
  responses: {
    201: jsonContent("The created (or upserted) deck", dataEnvelope(cruiseDeckRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    409: jsonContent("External cruise/ship is read-only", errorResponseSchema),
  },
})

const updateDeckRoute = createRoute({
  method: "put",
  path: "/decks/{deckId}",
  request: {
    params: z.object({ deckId: z.string() }),
    body: { required: true, content: { "application/json": { schema: updateDeckSchema } } },
  },
  responses: {
    200: jsonContent("The updated deck", dataEnvelope(cruiseDeckRowSchema)),
    404: jsonContent("Deck not found", errorResponseSchema),
  },
})

const listShipCategoriesRoute = createRoute({
  method: "get",
  path: "/ships/{key}/categories",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "Cabin categories for the ship (local rows or external adapter shapes)",
      arrayEnvelope(z.unknown()),
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const replaceShipCategoriesRoute = createRoute({
  method: "put",
  path: "/ships/{key}/categories/bulk",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ categories: z.array(insertCabinCategorySchema) }),
        },
      },
    },
  },
  responses: {
    200: jsonContent("The upserted cabin categories", arrayEnvelope(cruiseCabinCategoryRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    409: jsonContent("External cruise/ship is read-only", errorResponseSchema),
  },
})

const updateCategoryRoute = createRoute({
  method: "put",
  path: "/categories/{categoryId}",
  request: {
    params: z.object({ categoryId: z.string() }),
    body: {
      required: true,
      content: { "application/json": { schema: updateCabinCategorySchema } },
    },
  },
  responses: {
    200: jsonContent("The updated cabin category", dataEnvelope(cruiseCabinCategoryRowSchema)),
    404: jsonContent("Cabin category not found", errorResponseSchema),
  },
})

const listCategoryCabinsRoute = createRoute({
  method: "get",
  path: "/categories/{categoryId}/cabins",
  request: { params: z.object({ categoryId: z.string() }) },
  responses: {
    200: jsonContent("Cabins in the category", arrayEnvelope(cruiseCabinRowSchema)),
  },
})

const replaceCategoryCabinsRoute = createRoute({
  method: "put",
  path: "/categories/{categoryId}/cabins/bulk",
  request: {
    params: z.object({ categoryId: z.string() }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ cabins: z.array(insertCabinSchema.omit({ categoryId: true })) }),
        },
      },
    },
  },
  responses: {
    200: jsonContent("The upserted cabins", arrayEnvelope(cruiseCabinRowSchema)),
  },
})

const updateCabinRoute = createRoute({
  method: "put",
  path: "/cabins/{cabinId}",
  request: {
    params: z.object({ cabinId: z.string() }),
    body: { required: true, content: { "application/json": { schema: updateCabinSchema } } },
  },
  responses: {
    200: jsonContent("The updated cabin", dataEnvelope(cruiseCabinRowSchema)),
    404: jsonContent("Cabin not found", errorResponseSchema),
  },
})

export function registerCruiseShipRoutes(app: OpenAPIHono<Env>) {
  // --- ships ---
  app.openapi(listShipsRoute, async (c) => {
    const result = await cruisesService.listShips(c.get("db"), c.req.valid("query"))
    return c.json(result, 200)
  })
  app.openapi(createShipRoute, async (c) => {
    const row = await cruisesService.createShip(c.get("db"), c.req.valid("json"))
    return c.json({ data: row }, 201)
  })
  app.openapi(getShipRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const ship = await ext.adapter.fetchShip(ext.sourceRef)
      if (!ship) return c.json({ error: "not_found" }, 404)
      return c.json(
        {
          data: {
            source: "external" as const,
            sourceProvider: ext.adapter.name,
            sourceRef: ship.sourceRef,
            ship,
          },
        },
        200,
      )
    }
    const row = await cruisesService.getShipById(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(getShipEffectiveRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") {
      return c.json(invalidKey(c.req.valid("param").key), 400)
    }
    const subject = await resolveShipPresentationSubject(c.get("db"), parsed)
    if (subject.kind === "adapter-missing")
      return c.json(adapterNotRegistered(subject.provider), 501)
    if (subject.kind === "not-found") return c.json({ error: "not_found" }, 404)
    const query = c.req.valid("query")
    const data = await readPublicCruiseShipProjection(c.get("db"), subject.id, {
      locale: query.locale,
      audience: query.audience,
      market: query.market,
    })
    if (!data) return c.json({ error: "not_found" }, 404)
    return c.json({ data }, 200)
  })
  app.openapi(getShipEditorialOverlayRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") {
      return c.json(invalidKey(c.req.valid("param").key), 400)
    }
    requireUserId(c)
    const subject = await resolveShipPresentationSubject(c.get("db"), parsed)
    if (subject.kind === "adapter-missing")
      return c.json(adapterNotRegistered(subject.provider), 501)
    if (subject.kind === "not-found") return c.json({ error: "not_found" }, 404)
    const query = c.req.valid("query")
    const data = await readCruiseShipOverlayState(c.get("db"), subject.id, {
      locale: query.locale,
      audience: query.audience,
      market: query.market,
    })
    if (!data) return c.json({ error: "not_found" }, 404)
    return c.json({ data }, 200)
  })
  app.openapi(writeShipEditorialOverlayRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") {
      return c.json(invalidKey(c.req.valid("param").key), 400)
    }
    const userId = requireUserId(c)
    const subject = await resolveShipPresentationSubject(c.get("db"), parsed)
    if (subject.kind === "adapter-missing")
      return c.json(adapterNotRegistered(subject.provider), 501)
    if (subject.kind === "not-found") return c.json({ error: "not_found" }, 404)
    const body = c.req.valid("json")
    try {
      const row = await writeCruiseShipOverlay(c.get("db"), subject.id, {
        field_path: body.fieldPath,
        scope: {
          locale: body.locale,
          audience: body.audience,
          market: body.market,
        },
        value: body.value,
        expected_version: body.expectedVersion,
        editorial_note: body.editorialNote,
        origin: { kind: "admin-ui", user_id: userId },
      })
      const invalidation = cruiseShipOverlayInvalidationScope(row.field_path, {
        locale: row.locale,
        audience: row.audience,
        market: row.market,
      })
      await emitCruiseShipOverlayChanged(c.get("eventBus"), {
        entity_module: row.entity_module,
        entity_id: row.entity_id,
        field_path: row.field_path,
        ...invalidation,
        occurred_at: new Date().toISOString(),
      })
      return c.json({ data: row }, 200)
    } catch (err) {
      if (err instanceof OverlayVersionConflictError) {
        return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
      }
      return c.json({ error: "invalid_editorial_overlay", detail: errorMessage(err) }, 400)
    }
  })
  app.openapi(clearShipEditorialOverlayRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") {
      return c.json(invalidKey(c.req.valid("param").key), 400)
    }
    requireUserId(c)
    const subject = await resolveShipPresentationSubject(c.get("db"), parsed)
    if (subject.kind === "adapter-missing")
      return c.json(adapterNotRegistered(subject.provider), 501)
    if (subject.kind === "not-found") return c.json({ error: "not_found" }, 404)
    const query = c.req.valid("query")
    try {
      const row = await clearCruiseShipOverlay(c.get("db"), subject.id, {
        field_path: query.fieldPath,
        scope: {
          locale: query.locale,
          audience: query.audience,
          market: query.market,
        },
        expected_version: query.expectedVersion,
      })
      if (row) {
        const invalidation = cruiseShipOverlayInvalidationScope(row.field_path, {
          locale: row.locale,
          audience: row.audience,
          market: row.market,
        })
        await emitCruiseShipOverlayChanged(c.get("eventBus"), {
          entity_module: row.entity_module,
          entity_id: row.entity_id,
          field_path: row.field_path,
          ...invalidation,
          occurred_at: new Date().toISOString(),
        })
      }
      return c.json({ data: { cleared: row != null, overlay: row } }, 200)
    } catch (err) {
      if (err instanceof OverlayVersionConflictError) {
        return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
      }
      return c.json({ error: "invalid_editorial_overlay", detail: errorMessage(err) }, 400)
    }
  })
  app.openapi(shipEditorialOverlayHistoryRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") {
      return c.json(invalidKey(c.req.valid("param").key), 400)
    }
    requireUserId(c)
    const subject = await resolveShipPresentationSubject(c.get("db"), parsed)
    if (subject.kind === "adapter-missing")
      return c.json(adapterNotRegistered(subject.provider), 501)
    if (subject.kind === "not-found") return c.json({ error: "not_found" }, 404)
    const query = c.req.valid("query")
    const rows = await listCruiseShipOverlayHistory(c.get("db"), subject.id, {
      field_path: query.fieldPath,
      locale: query.locale,
      audience: query.audience,
      market: query.market,
    })
    return c.json({ data: rows }, 200)
  })
  app.openapi(updateShipRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const row = await cruisesService.updateShip(c.get("db"), parsed.id, c.req.valid("json"))
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(listShipDecksRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const ship = await ext.adapter.fetchShip(ext.sourceRef)
      return c.json({ data: ship?.decks ?? [] }, 200)
    }
    const decks = await cruisesService.listShipDecks(c.get("db"), parsed.id)
    return c.json({ data: decks }, 200)
  })
  app.openapi(createShipDeckRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const data = c.req.valid("json")
    const row = await cruisesService.upsertDeck(c.get("db"), { ...data, shipId: parsed.id })
    return c.json({ data: row }, 201)
  })
  app.openapi(updateDeckRoute, async (c) => {
    const row = await cruisesService.updateDeck(
      c.get("db"),
      c.req.valid("param").deckId,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(listShipCategoriesRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const ship = await ext.adapter.fetchShip(ext.sourceRef)
      return c.json({ data: ship?.categories ?? [] }, 200)
    }
    const categories = await cruisesService.listShipCabinCategories(c.get("db"), parsed.id)
    return c.json({ data: categories }, 200)
  })
  app.openapi(replaceShipCategoriesRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const payload = c.req.valid("json")
    const out: Awaited<ReturnType<typeof cruisesService.upsertCabinCategory>>[] = []
    for (const cat of payload.categories) {
      const row = await cruisesService.upsertCabinCategory(c.get("db"), {
        ...cat,
        shipId: parsed.id,
      })
      out.push(row)
    }
    return c.json({ data: out }, 200)
  })
  app.openapi(updateCategoryRoute, async (c) => {
    const row = await cruisesService.updateCabinCategory(
      c.get("db"),
      c.req.valid("param").categoryId,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(listCategoryCabinsRoute, async (c) => {
    const cabins = await cruisesService.listCabinsByCategory(
      c.get("db"),
      c.req.valid("param").categoryId,
    )
    return c.json({ data: cabins }, 200)
  })
  app.openapi(replaceCategoryCabinsRoute, async (c) => {
    const categoryId = c.req.valid("param").categoryId
    const payload = c.req.valid("json")
    const out: Awaited<ReturnType<typeof cruisesService.upsertCabin>>[] = []
    for (const cabin of payload.cabins) {
      const row = await cruisesService.upsertCabin(c.get("db"), { ...cabin, categoryId })
      out.push(row)
    }
    return c.json({ data: out }, 200)
  })
  app.openapi(updateCabinRoute, async (c) => {
    const row = await cruisesService.updateCabin(
      c.get("db"),
      c.req.valid("param").cabinId,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function resolveShipPresentationSubject(
  db: Parameters<typeof cruisesService.getShipById>[0],
  parsed: Exclude<ReturnType<typeof parseUnifiedKey>, { kind: "invalid" }>,
): Promise<
  { kind: "ok"; id: string } | { kind: "adapter-missing"; provider: string } | { kind: "not-found" }
> {
  if (parsed.kind === "local") return { kind: "ok", id: parsed.id }
  const ext = resolveExternal(parsed)
  if (!ext) return { kind: "adapter-missing", provider: parsed.provider }
  const ship = await ext.adapter.fetchShip(ext.sourceRef)
  if (!ship) return { kind: "not-found" }
  const subject = await ingestExternalCruiseShip(db, ext.adapter.name, ship)
  return { kind: "ok", id: subject.entity_id }
}
