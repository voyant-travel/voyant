import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  redirect,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router"
import type { AccommodationContent } from "@voyant-travel/accommodations/content-shape"
import type { BookingEntitySummary } from "@voyant-travel/bookings-react/journey"
import {
  type ContractSourceContext,
  StorefrontBookingJourney,
} from "@voyant-travel/bookings-react/storefront"
import type { CruiseContent } from "@voyant-travel/cruises/content-shape"
import type { ProductContent } from "@voyant-travel/inventory/content-shape"
import { getStorefrontCustomerProductDetailRoute } from "@voyant-travel/storefront-react"
import { useMemo } from "react"
import { z } from "zod"

import { getApiUrl } from "@/lib/env"
import { useStorefrontMessagesOrDefault } from "@/lib/storefront-i18n"
import { useStorefrontScope } from "@/lib/storefront-scope"

/**
 * Storefront booking-journey route. The customer arrives here from
 * the product / cruise / accommodations detail page with **the
 * relevant configure inputs already locked in** via search params.
 * The journey itself only handles travelers + add-ons + payment;
 * the Configure step is hidden because Configure already happened
 * upstream.
 *
 * Per booking-journey-architecture §10 Phase B.
 *
 * **No `sourceKind` in the URL.** The public engine route resolves
 * provenance from `(entityModule, entityId)` server-side.
 */
const shopBookSearchSchema = z.object({
  /** Schedule pointer — exactly the right subset per vertical:
   *   - products → `departureSlotId`
   *   - cruises  → `departureSlotId` (sailing id) +
   *               `cabinCategoryId`, optionally `cabinNumberId` +
   *               `airArrangement`
   *   - accommodations → `checkIn` + `checkOut` + `roomTypeId` +
   *               `ratePlanId`, optionally `board`
   * The detail page fills the right subset before navigating.
   */
  departureSlotId: z.string().optional(),
  cabinCategoryId: z.string().optional(),
  cabinNumberId: z.string().optional(),
  airArrangement: z.enum(["cruise_line", "independent", "none"]).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  ratePlanId: z.string().optional(),
  board: z.string().optional(),
  /** Pax counts per band. Adults default to 1 if absent so the
   *  validation passes; children + infants default to 0. */
  adult: z.coerce.number().int().min(0).optional(),
  child: z.coerce.number().int().min(0).optional(),
  infant: z.coerce.number().int().min(0).optional(),
  draftId: z.string().optional(),
})

export const Route = createFileRoute("/(storefront)/shop_/book/$entityModule/$entityId")({
  // Guard against stale/bookmarked booking URLs for verticals that aren't
  // customer-bookable. Search already hides them; gate the direct booking
  // route on the same source of truth so it can't reach a broken reserve flow.
  // Redirect back to the shop instead.
  beforeLoad: ({ params }) => {
    if (!getStorefrontCustomerProductDetailRoute(params.entityModule, params.entityId)) {
      throw redirect({ to: "/shop" })
    }
  },
  component: ShopBookRouteComponent,
  validateSearch: shopBookSearchSchema,
})

function ShopBookRouteComponent(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/book/$entityModule/$entityId",
  })
  const search = useSearch({ from: "/(storefront)/shop_/book/$entityModule/$entityId" })
  const t = useStorefrontMessagesOrDefault().bookingJourney
  const scope = useStorefrontScope()
  const navigate = useNavigate()
  const draftId = useMemo(() => search.draftId ?? generateDraftId(), [search.draftId])

  const initialConfigure: Record<string, unknown> = {
    pax: {
      adult: search.adult ?? 1,
      child: search.child ?? 0,
      infant: search.infant ?? 0,
    },
  }
  if (search.departureSlotId) initialConfigure.departureSlotId = search.departureSlotId
  if (search.cabinCategoryId) initialConfigure.cabinCategoryId = search.cabinCategoryId
  if (search.cabinNumberId) initialConfigure.cabinNumberId = search.cabinNumberId
  if (search.airArrangement) initialConfigure.airArrangement = search.airArrangement
  if (search.checkIn && search.checkOut) {
    initialConfigure.dateRange = { checkIn: search.checkIn, checkOut: search.checkOut }
  }
  if (search.roomTypeId) initialConfigure.roomTypeId = search.roomTypeId
  if (search.ratePlanId) initialConfigure.ratePlanId = search.ratePlanId
  if (search.board) initialConfigure.board = search.board

  const initialAccommodation = search.roomTypeId
    ? {
        rooms: [
          {
            optionUnitId: search.roomTypeId,
            quantity: 1,
            ...(search.ratePlanId ? { ratePlanId: search.ratePlanId } : {}),
          },
        ],
        travelerAssignments: {},
      }
    : undefined

  const { summary: entitySummary, source: entitySource } = useEntityContent(
    entityModule,
    entityId,
    search,
  )

  return (
    <StorefrontBookingJourney
      entityModule={entityModule}
      entityId={entityId}
      draftId={draftId}
      initialConfigure={initialConfigure}
      initialAccommodation={initialAccommodation}
      entitySummary={entitySummary}
      entitySource={entitySource}
      messages={t}
      scope={scope}
      onNavigateToShop={() => void navigate({ to: "/shop" })}
      onNavigateToConfirmation={(bookingId, kind) => {
        if (kind) {
          void navigate({
            to: "/shop/confirmation/$bookingId",
            params: { bookingId },
            search: { kind } as never,
          })
          return
        }
        void navigate({ to: "/shop/confirmation/$bookingId", params: { bookingId } })
      }}
      // No `contractTemplateSlug` — the wrapper resolves whichever
      // customer-scope template the operator has marked active via
      // /v1/public/legal/contracts/templates/default. Per-product
      // overrides plug in here once products grow a
      // `contractTemplateSlug` field.
      contractMarketingLabel={t.marketingLabel}
    />
  )
}

/**
 * Provenance block returned alongside the content payload by the
 * vertical content endpoints (`{ data: { content, provenance, ... } }`).
 * Mirrors `contentProvenanceSchema` in the vertical `routes-content.ts`.
 */
interface ContentProvenance {
  source_kind: string
  source_provider?: string
  source_connection_id?: string
  source_ref?: string
}

interface EntityContentEnvelope {
  content?: unknown
  provenance?: ContentProvenance
}

/**
 * Pull the entity content for the side-panel summary AND the contract
 * preview's source provenance. Three vertical-specific endpoints share
 * the same `{ data: { content, provenance, served_locale, ... } }`
 * envelope; we map each into a vertical-agnostic `BookingEntitySummary`
 * plus a `ContractSourceContext` so a sourced/connected product carries
 * its real supplier + provenance into the customer contract instead of
 * defaulting to owned/blank (voyant#2619).
 */
function useEntityContent(
  entityModule: string,
  entityId: string,
  search: ShopBookSearch,
): { summary: BookingEntitySummary | undefined; source: ContractSourceContext | undefined } {
  const url =
    entityModule === "cruises"
      ? `${getApiUrl()}/v1/public/cruises/${encodeURIComponent(entityId)}/content`
      : entityModule === "accommodations"
        ? `${getApiUrl()}/v1/public/accommodations/${encodeURIComponent(entityId)}/content`
        : entityModule === "products"
          ? `${getApiUrl()}/v1/public/products/${encodeURIComponent(entityId)}/content`
          : null

  const { data } = useQuery({
    queryKey: ["public-entity-summary", entityModule, entityId],
    queryFn: async (): Promise<EntityContentEnvelope | null> => {
      if (!url) return null
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: EntityContentEnvelope }
      return json.data ?? null
    },
    enabled: Boolean(url),
    staleTime: 60_000,
  })

  const content = data?.content ?? null

  const source = useMemo<ContractSourceContext | undefined>(
    () => resolveEntitySource(entityModule, data?.provenance, content),
    [entityModule, data?.provenance, content],
  )

  const summary = useMemo<BookingEntitySummary | undefined>(() => {
    if (!content) return undefined
    if (entityModule === "products") {
      const c = content as ProductContent
      const subtitleParts = [
        c.product.duration_days
          ? `${c.product.duration_days} day${c.product.duration_days === 1 ? "" : "s"}`
          : null,
        c.product.country ?? null,
      ].filter(Boolean) as string[]
      const dep = c.departures?.find((d) => d.id === search.departureSlotId)
      return {
        name: c.product.name,
        subtitle: subtitleParts.join(" · ") || undefined,
        heroImageUrl: c.product.hero_image_url ?? c.media?.[0]?.url ?? undefined,
        vertical: "products",
        whenLabel: dep ? formatDate(dep.starts_at) : undefined,
        locationLabel: c.product.departure_city ?? c.product.country ?? undefined,
        startDate: dep?.starts_at ?? undefined,
        endDate: dep?.ends_at ?? undefined,
        destination: c.product.country ?? c.product.departure_city ?? undefined,
      }
    }
    if (entityModule === "cruises") {
      const c = content as CruiseContent
      const sailing = c.sailings.find((s) => s.id === search.departureSlotId)
      const subtitleParts = [
        c.cruise.duration_nights
          ? `${c.cruise.duration_nights} night${c.cruise.duration_nights === 1 ? "" : "s"}`
          : null,
        c.ship?.name ?? null,
      ].filter(Boolean) as string[]
      const route = sailing
        ? sailing.embarkation_port && sailing.disembarkation_port
          ? `${sailing.embarkation_port} → ${sailing.disembarkation_port}`
          : (sailing.embarkation_port ?? null)
        : null
      return {
        name: c.cruise.name,
        subtitle: subtitleParts.join(" · ") || undefined,
        heroImageUrl: c.cruise.hero_image_url ?? undefined,
        vertical: "cruises",
        whenLabel: sailing ? formatDate(sailing.start_date) : undefined,
        locationLabel: route ?? undefined,
        startDate: sailing?.start_date ?? undefined,
        endDate: sailing?.end_date ?? undefined,
        destination: route ?? undefined,
      }
    }
    if (entityModule === "accommodations") {
      const c = content as AccommodationContent
      const stars = c.hotel.star_rating ? "★".repeat(Math.floor(c.hotel.star_rating)) : null
      return {
        name: c.hotel.name,
        subtitle: stars ?? undefined,
        heroImageUrl: c.hotel.hero_image_url ?? undefined,
        vertical: "accommodations",
        whenLabel:
          search.checkIn && search.checkOut
            ? `${formatDate(search.checkIn)} → ${formatDate(search.checkOut)}`
            : undefined,
        startDate: search.checkIn ?? undefined,
        endDate: search.checkOut ?? undefined,
        destination: c.hotel.city ?? c.hotel.country ?? undefined,
      }
    }
    return undefined
  }, [content, entityModule, search.departureSlotId, search.checkIn, search.checkOut])

  return { summary, source }
}

/**
 * Map the content endpoint's `provenance` block + vertical supplier
 * into the `ContractSourceContext` the contract preview reads. Owned
 * inventory (`source_kind: "owned"`) and a missing provenance both
 * yield the owned arm downstream; sourced inventory carries its real
 * kind / connection / ref + supplier name (voyant#2619).
 */
function resolveEntitySource(
  entityModule: string,
  provenance: ContentProvenance | undefined,
  content: unknown,
): ContractSourceContext | undefined {
  if (!provenance) return undefined
  const supplierName = extractSupplierName(entityModule, content)
  return {
    kind: provenance.source_kind,
    connectionId: provenance.source_connection_id ?? "",
    ref: provenance.source_ref ?? "",
    supplier: { id: "", name: supplierName },
  }
}

/** Pull the customer-facing supplier display name off the vertical
 *  content payload. Only products currently expose it. */
function extractSupplierName(entityModule: string, content: unknown): string {
  if (entityModule === "products" && content) {
    return (content as ProductContent).product.supplier ?? ""
  }
  return ""
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

type ShopBookSearch = z.infer<typeof shopBookSearchSchema>

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, ``)}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
