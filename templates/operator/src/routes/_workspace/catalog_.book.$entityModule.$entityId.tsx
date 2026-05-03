import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CatalogBookingPage } from "@/components/voyant/catalog/catalog-booking-page"

/**
 * Catalog booking journey. The path identifies the catalog row
 * (entity_module + entity_id); search params carry the source pointer
 * the catalog UI knows about, so the booking page doesn't need to
 * re-resolve provenance from the search index. Refresh-safe.
 *
 * The booking page itself runs the quote → book lifecycle against the
 * operator's catalog booking-engine routes (`/v1/admin/catalog/quote`
 * + `/v1/admin/catalog/book`).
 */
const catalogBookSearchSchema = z.object({
  /** Source kind — e.g. "demo", "voyant-connect", "direct:tui". */
  sourceKind: z.string().min(1),
  /** Upstream reference id when the adapter exposes one. */
  sourceRef: z.string().optional(),
  /** Display name shown in the header before the live quote arrives. */
  name: z.string().optional(),
  /** Supplier id from the catalog row, used for the optimistic header. */
  supplierId: z.string().optional(),
  /** Locale override; defaults to en-GB to match DEFAULT_SLICES. */
  locale: z.string().optional(),
  /**
   * Pinned departure when the operator clicked a specific row in the
   * catalog detail sheet's Departures section. The booking page uses
   * this to seed the quote request with the chosen slot.
   */
  departureId: z.string().optional(),
  /** ISO timestamp for the pinned departure — convenience for the header. */
  departureStartsAt: z.string().optional(),
})

export type CatalogBookSearchParams = z.infer<typeof catalogBookSearchSchema>

export const Route = createFileRoute("/_workspace/catalog_/book/$entityModule/$entityId")({
  component: CatalogBookingPage,
  validateSearch: catalogBookSearchSchema,
})
