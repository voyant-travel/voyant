/**
 * Operator wiring for the in-deployment MCP server.
 *
 * The framework tool contract (`@voyant-travel/tools`) and the MCP transport
 * (`@voyant-travel/mcp`) are generic; this file supplies the deployment
 * specifics: which tools to register, and how to build the per-request
 * `ToolContext` — including binding the trips service to this request's `db` +
 * dependency wiring.
 *
 * The route mounts at `/v1/admin/mcp` via the `"operator/mcp"` composition entry.
 */

import {
  bookingsService,
  redactBookingContact,
  shouldRevealBookingPii,
} from "@voyant-travel/bookings"
import { type BookingsToolServices, bookingsTools } from "@voyant-travel/bookings/tools"
import {
  type CatalogToolServices,
  catalogTools,
  executeSemanticSearch,
} from "@voyant-travel/catalog"
import { financeService } from "@voyant-travel/finance"
import { type FinanceToolServices, financeTools } from "@voyant-travel/finance/tools"
import { isStaffRbacEnforced } from "@voyant-travel/hono"
import { productsService } from "@voyant-travel/inventory"
import { type InventoryToolServices, inventoryTools } from "@voyant-travel/inventory/tools"
import { createMcpHonoApp } from "@voyant-travel/mcp"
import { createNotificationService, notificationsService } from "@voyant-travel/notifications"
import {
  type NotificationsToolServices,
  notificationsTools,
} from "@voyant-travel/notifications/tools"
import { quotesService } from "@voyant-travel/quotes"
import { type QuotesToolServices, quotesTools } from "@voyant-travel/quotes/tools"
import { relationshipsService } from "@voyant-travel/relationships"
import {
  type RelationshipsToolServices,
  relationshipsTools,
} from "@voyant-travel/relationships/tools"
import { createToolRegistry, type ToolContext, ToolError } from "@voyant-travel/tools"
import { type TripsToolServices, tripsService, tripsTools } from "@voyant-travel/trips"
import type { Context, Hono } from "hono"
import { resolveNotificationProviders } from "../../lib/notifications"
import { buildCatalogContext } from "../lib/catalog-context"
import { DEFAULT_SLICES } from "../lib/catalog-runtime"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

/** The per-request tool context shape this deployment builds (base + injected services). */
type OperatorToolContext = ToolContext & {
  catalog: CatalogToolServices
  trips: TripsToolServices
  inventory: InventoryToolServices
  bookings: BookingsToolServices
  finance: FinanceToolServices
  quotes: QuotesToolServices
  relationships: RelationshipsToolServices
  notifications: NotificationsToolServices
}

type BookingContactRow = {
  contactFirstName?: string | null
  contactLastName?: string | null
  contactTaxId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactAddressLine1?: string | null
  contactAddressLine2?: string | null
  contactPostalCode?: string | null
  [key: string]: unknown
}

/** Build the MCP admin routes wired with this deployment's tools + context. */
export function buildMcpAdminRoutes(): Hono {
  const registry = createToolRegistry()
  registry.registerAll(catalogTools)
  registry.registerAll(tripsTools)
  registry.registerAll(inventoryTools)
  registry.registerAll(bookingsTools)
  registry.registerAll(financeTools)
  registry.registerAll(quotesTools)
  registry.registerAll(relationshipsTools)
  registry.registerAll(notificationsTools)
  return createMcpHonoApp({ registry, buildContext: buildToolContext })
}

function buildToolContext(c: Context): OperatorToolContext {
  const env = c.env as CloudflareBindings & { TENANT_ID?: string }
  const actor = (c.var.actor ?? "staff") as ToolContext["actor"]
  const audience = (c.var.audience ?? actor) as ToolContext["audience"]
  const locale = DEFAULT_SLICES[0]?.locale ?? "en-GB"
  return {
    db: c.var.db,
    actor,
    audience,
    tenantId: env.TENANT_ID ?? "default",
    resolverScope: { locale, audience, market: "default", actor },
    catalog: createCatalogToolServices(c),
    trips: createTripsToolServices(c),
    inventory: createInventoryToolServices(c),
    bookings: createBookingsToolServices(c),
    finance: {
      listInvoices: (query) => financeService.listInvoices(c.var.db, query),
      getInvoiceById: (id) => financeService.getInvoiceById(c.var.db, id),
      voidInvoice: (id, input) => financeService.voidInvoice(c.var.db, id, input),
    },
    quotes: {
      listQuotes: (query) => quotesService.listQuotes(c.var.db, query),
      getQuoteById: (id) => quotesService.getQuoteById(c.var.db, id),
      acceptQuoteVersion: (quoteVersionId) =>
        quotesService.acceptQuoteVersion(c.var.db, quoteVersionId),
    },
    relationships: {
      listPeople: (query) => relationshipsService.listPeople(c.var.db, query),
      getPersonById: (id) => relationshipsService.getPersonById(c.var.db, id),
      listOrganizations: (query) => relationshipsService.listOrganizations(c.var.db, query),
      getOrganizationById: (id) => relationshipsService.getOrganizationById(c.var.db, id),
    },
    notifications: {
      listDeliveries: (query) => notificationsService.listDeliveries(c.var.db, query),
      getDeliveryById: (id) => notificationsService.getDeliveryById(c.var.db, id),
      // Template-only send (the tool rejects raw content). Dispatches through the
      // deployment's real provider runtime — same path the app uses.
      sendTemplated: (input) =>
        notificationsService.sendNotification(
          c.var.db,
          createNotificationService(resolveNotificationProviders(c.env as Record<string, unknown>)),
          { ...input, targetType: "other" },
        ),
    },
  }
}

function createBookingsToolServices(c: Context): BookingsToolServices {
  const reveal = shouldRevealBookingPii({
    actor: c.var.actor,
    scopes: c.var.scopes,
    callerType: c.var.callerType,
    isInternalRequest: c.var.isInternalRequest,
    enforceRbac: isStaffRbacEnforced(c.env),
  })

  return {
    async listBookings(query) {
      const result = await bookingsService.listBookings(c.var.db, query)
      if (reveal) return result
      return redactBookingListResult(result)
    },
    async getBookingById(id) {
      const row = await bookingsService.getBookingById(c.var.db, id)
      if (reveal || !row) return row
      return redactBookingRow(row)
    },
  }
}

function createCatalogToolServices(c: Context): CatalogToolServices {
  const catalogContext = buildCatalogContext(c)
  return {
    async search({ slice, request }) {
      const indexer = catalogContext.catalog.indexer
      if (!indexer) {
        throw new ToolError(
          "Catalog search indexer is not configured for this deployment.",
          "PROVIDER_ERROR",
        )
      }
      if (request.mode === "keyword") return indexer.search(slice, request)

      try {
        return await executeSemanticSearch({
          adapter: indexer,
          embeddings: catalogContext.catalog.embeddings,
          slice,
          request,
        })
      } catch {
        const keywordRequest = {
          ...request,
          mode: "keyword" as const,
          query_embedding: undefined,
          query_embedding_model_id: undefined,
        }
        return indexer.search(slice, keywordRequest)
      }
    },
    async getEntry({ vertical, id, scope }) {
      const entry = await catalogContext.catalog.resolveEntity?.(vertical, id, scope)
      if (!entry) return null
      return {
        vertical: entry.vertical,
        id: entry.entityId,
        fields: entry.fields,
        provenance: entry.provenance,
      }
    },
  }
}

function redactBookingListResult<T>(result: T): T {
  if (!isRecord(result) || !Array.isArray(result.data)) return result
  return { ...result, data: result.data.map((row) => redactBookingRow(row)) }
}

function redactBookingRow<T>(row: T): T {
  if (!isRecord(row)) return row
  return redactBookingContact(row as BookingContactRow) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createInventoryToolServices(c: Context): InventoryToolServices {
  return {
    listProducts: (query) => productsService.listProducts(c.var.db, query),
    getProductById: (id) => productsService.getProductById(c.var.db, id),
  }
}

function createTripsToolServices(c: Context): TripsToolServices {
  const options = createOperatorTripsRoutesOptions()
  return {
    createTrip: (input) => tripsService.createTrip(c.var.db, input),
    addComponent: (input) => tripsService.addComponent(c.var.db, input),
    removeComponent: (componentId) => tripsService.removeComponent(c.var.db, componentId),
    priceTrip: async (input) => {
      const deps = await resolveDeps(c, options.priceTripDeps)
      if (!deps) throw new Error("Trips price dependencies are not configured")
      return tripsService.priceTrip(c.var.db, input, deps)
    },
    reserveTrip: async (input) => {
      const deps = await resolveDeps(c, options.reserveTripDeps)
      if (!deps) throw new Error("Trips reserve dependencies are not configured")
      return tripsService.reserveTrip(c.var.db, input, deps)
    },
  }
}

function resolveDeps<T>(
  c: Context,
  deps: T | ((c: Context) => T | Promise<T | undefined> | undefined) | undefined,
) {
  if (typeof deps !== "function") return deps
  return (deps as (c: Context) => T | Promise<T | undefined> | undefined)(c)
}
