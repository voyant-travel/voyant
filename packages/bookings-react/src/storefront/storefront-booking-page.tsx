import { useQuery } from "@tanstack/react-query"
import type { AccommodationContent } from "@voyant-travel/accommodations/content-shape"
import type { CruiseContent } from "@voyant-travel/cruises/content-shape"
import type { ProductContent } from "@voyant-travel/inventory/content-shape"
import { useStorefrontUi } from "@voyant-travel/storefront-react/storefront"
import { useMemo } from "react"
import { z } from "zod"

import type { BookingEntitySummary } from "../journey/index.js"
import type { ContractSourceContext } from "./resolve-contract-variables.js"
import {
  StorefrontBookingJourney,
  type StorefrontBookingJourneyMessages,
  type StorefrontBookingJourneyProps,
} from "./storefront-booking-journey.js"

export const storefrontBookingSearchSchema = z.object({
  departureSlotId: z.string().optional(),
  cabinCategoryId: z.string().optional(),
  cabinNumberId: z.string().optional(),
  airArrangement: z.enum(["cruise_line", "independent", "none"]).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  ratePlanId: z.string().optional(),
  board: z.string().optional(),
  adult: z.coerce.number().int().min(0).optional(),
  child: z.coerce.number().int().min(0).optional(),
  infant: z.coerce.number().int().min(0).optional(),
  draftId: z.string().optional(),
})

export type StorefrontBookingSearch = z.infer<typeof storefrontBookingSearchSchema>

export interface StorefrontBookingPageMessages extends StorefrontBookingJourneyMessages {
  marketingLabel?: string
}

export type StorefrontBookingPageExtensions = Pick<
  StorefrontBookingJourneyProps,
  | "className"
  | "contractMarketingLabel"
  | "contractTemplateSlug"
  | "onContractAccepted"
  | "onRedirectToPayment"
>

export interface StorefrontBookingPageProps {
  entityModule: string
  entityId: string
  search: StorefrontBookingSearch
  messages: StorefrontBookingPageMessages
  extensions?: StorefrontBookingPageExtensions
}

/** Customer booking page shared by Node applications and dedicated storefronts. */
export function StorefrontBookingPage({
  entityModule,
  entityId,
  search,
  messages,
  extensions,
}: StorefrontBookingPageProps): React.ReactElement {
  const { apiUrl, navigate, scope } = useStorefrontUi()
  const draftId = useMemo(() => search.draftId ?? generateDraftId(), [search.draftId])
  const initialConfigure = buildInitialConfigure(search)
  const initialAccommodation = buildInitialAccommodation(search)
  const { summary, source } = useEntityContent(apiUrl, entityModule, entityId, search)

  return (
    <StorefrontBookingJourney
      entityModule={entityModule}
      entityId={entityId}
      draftId={draftId}
      initialConfigure={initialConfigure}
      initialAccommodation={initialAccommodation}
      entitySummary={summary}
      entitySource={source}
      messages={messages}
      scope={scope}
      onNavigateToShop={() => navigate({ to: "/shop" })}
      onNavigateToConfirmation={(bookingId, kind) =>
        navigate({
          to: "/shop/confirmation/$bookingId",
          params: { bookingId },
          ...(kind ? { search: { kind } } : {}),
        })
      }
      {...(messages.marketingLabel !== undefined
        ? { contractMarketingLabel: messages.marketingLabel }
        : {})}
      {...extensions}
    />
  )
}

function buildInitialConfigure(search: StorefrontBookingSearch): Record<string, unknown> {
  const configure: Record<string, unknown> = {
    pax: {
      adult: search.adult ?? 1,
      child: search.child ?? 0,
      infant: search.infant ?? 0,
    },
  }
  if (search.departureSlotId) configure.departureSlotId = search.departureSlotId
  if (search.cabinCategoryId) configure.cabinCategoryId = search.cabinCategoryId
  if (search.cabinNumberId) configure.cabinNumberId = search.cabinNumberId
  if (search.airArrangement) configure.airArrangement = search.airArrangement
  if (search.checkIn && search.checkOut) {
    configure.dateRange = { checkIn: search.checkIn, checkOut: search.checkOut }
  }
  if (search.roomTypeId) configure.roomTypeId = search.roomTypeId
  if (search.ratePlanId) configure.ratePlanId = search.ratePlanId
  if (search.board) configure.board = search.board
  return configure
}

function buildInitialAccommodation(
  search: StorefrontBookingSearch,
): Record<string, unknown> | undefined {
  if (!search.roomTypeId) return undefined
  return {
    rooms: [
      {
        optionUnitId: search.roomTypeId,
        quantity: 1,
        ...(search.ratePlanId ? { ratePlanId: search.ratePlanId } : {}),
      },
    ],
    travelerAssignments: {},
  }
}

interface ContentProvenance {
  source_kind: string
  source_connection_id?: string
  source_ref?: string
}

interface EntityContentEnvelope {
  content?: unknown
  provenance?: ContentProvenance
}

function useEntityContent(
  apiUrl: string,
  entityModule: string,
  entityId: string,
  search: StorefrontBookingSearch,
): { summary: BookingEntitySummary | undefined; source: ContractSourceContext | undefined } {
  const url = entityContentUrl(apiUrl, entityModule, entityId)
  const { data } = useQuery({
    queryKey: ["public-entity-summary", entityModule, entityId],
    queryFn: async (): Promise<EntityContentEnvelope | null> => {
      if (!url) return null
      const response = await fetch(url, { credentials: "include" })
      if (!response.ok) return null
      const json = (await response.json()) as { data?: EntityContentEnvelope }
      return json.data ?? null
    },
    enabled: Boolean(url),
    staleTime: 60_000,
  })
  const content = data?.content ?? null
  const source = useMemo(
    () => resolveEntitySource(entityModule, data?.provenance, content),
    [entityModule, data?.provenance, content],
  )
  const summary = useMemo(
    () => resolveEntitySummary(entityModule, content, search),
    [content, entityModule, search],
  )
  return { summary, source }
}

function entityContentUrl(apiUrl: string, entityModule: string, entityId: string): string | null {
  const encodedId = encodeURIComponent(entityId)
  if (entityModule === "cruises") return `${apiUrl}/v1/public/cruises/${encodedId}/content`
  if (entityModule === "accommodations") {
    return `${apiUrl}/v1/public/accommodations/${encodedId}/content`
  }
  if (entityModule === "products") return `${apiUrl}/v1/public/products/${encodedId}/content`
  return null
}

function resolveEntitySummary(
  entityModule: string,
  content: unknown,
  search: StorefrontBookingSearch,
): BookingEntitySummary | undefined {
  if (!content) return undefined
  if (entityModule === "products") return resolveProductSummary(content as ProductContent, search)
  if (entityModule === "cruises") return resolveCruiseSummary(content as CruiseContent, search)
  if (entityModule === "accommodations") {
    return resolveAccommodationSummary(content as AccommodationContent, search)
  }
  return undefined
}

function resolveProductSummary(
  content: ProductContent,
  search: StorefrontBookingSearch,
): BookingEntitySummary {
  const subtitle = [
    content.product.duration_days
      ? `${content.product.duration_days} day${content.product.duration_days === 1 ? "" : "s"}`
      : null,
    content.product.country ?? null,
  ].filter(Boolean) as string[]
  const departure = content.departures?.find((item) => item.id === search.departureSlotId)
  return {
    name: content.product.name,
    subtitle: subtitle.join(" · ") || undefined,
    heroImageUrl: content.product.hero_image_url ?? content.media?.[0]?.url ?? undefined,
    vertical: "products",
    whenLabel: departure ? formatDate(departure.starts_at) : undefined,
    locationLabel: content.product.departure_city ?? content.product.country ?? undefined,
    startDate: departure?.starts_at ?? undefined,
    endDate: departure?.ends_at ?? undefined,
    destination: content.product.country ?? content.product.departure_city ?? undefined,
  }
}

function resolveCruiseSummary(
  content: CruiseContent,
  search: StorefrontBookingSearch,
): BookingEntitySummary {
  const sailing = content.sailings.find((item) => item.id === search.departureSlotId)
  const subtitle = [
    content.cruise.duration_nights
      ? `${content.cruise.duration_nights} night${content.cruise.duration_nights === 1 ? "" : "s"}`
      : null,
    content.ship?.name ?? null,
  ].filter(Boolean) as string[]
  const route = sailing
    ? sailing.embarkation_port && sailing.disembarkation_port
      ? `${sailing.embarkation_port} → ${sailing.disembarkation_port}`
      : (sailing.embarkation_port ?? null)
    : null
  return {
    name: content.cruise.name,
    subtitle: subtitle.join(" · ") || undefined,
    heroImageUrl: content.cruise.hero_image_url ?? undefined,
    vertical: "cruises",
    whenLabel: sailing ? formatDate(sailing.start_date) : undefined,
    locationLabel: route ?? undefined,
    startDate: sailing?.start_date ?? undefined,
    endDate: sailing?.end_date ?? undefined,
    destination: route ?? undefined,
  }
}

function resolveAccommodationSummary(
  content: AccommodationContent,
  search: StorefrontBookingSearch,
): BookingEntitySummary {
  const stars = content.hotel.star_rating ? "★".repeat(Math.floor(content.hotel.star_rating)) : null
  return {
    name: content.hotel.name,
    subtitle: stars ?? undefined,
    heroImageUrl: content.hotel.hero_image_url ?? undefined,
    vertical: "accommodations",
    whenLabel:
      search.checkIn && search.checkOut
        ? `${formatDate(search.checkIn)} → ${formatDate(search.checkOut)}`
        : undefined,
    startDate: search.checkIn ?? undefined,
    endDate: search.checkOut ?? undefined,
    destination: content.hotel.city ?? content.hotel.country ?? undefined,
  }
}

function resolveEntitySource(
  entityModule: string,
  provenance: ContentProvenance | undefined,
  content: unknown,
): ContractSourceContext | undefined {
  if (!provenance) return undefined
  const supplierName =
    entityModule === "products" && content
      ? ((content as ProductContent).product.supplier ?? "")
      : ""
  return {
    kind: provenance.source_kind,
    connectionId: provenance.source_connection_id ?? "",
    ref: provenance.source_ref ?? "",
    supplier: { id: "", name: supplierName },
  }
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

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, "")}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
