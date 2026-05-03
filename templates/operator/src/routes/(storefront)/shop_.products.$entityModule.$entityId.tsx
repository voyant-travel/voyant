"use client"

import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router"
import { type BookingDraftV1, bookingDraftV1 } from "@voyantjs/catalog/booking-engine"
import { useBookingQuote } from "@voyantjs/catalog-react/booking-engine"
import type { CruiseContent } from "@voyantjs/cruises/content-shape"
import type { HospitalityContent } from "@voyantjs/hospitality/content-shape"
import type { ProductContent } from "@voyantjs/products/content-shape"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { useEffect, useMemo, useState } from "react"

import { getApiUrl } from "@/lib/env"

/**
 * Per `catalog-sourced-content.md` §3.5.3, the content endpoints
 * return both the payload and locale-resolution metadata. The
 * detail page surfaces a small "served in <locale>" hint when the
 * fallback chain kicked in, and a "limited content available" hint
 * when the synthesizer (§3.6) produced the payload from the durable
 * sourced-entry projection rather than a real getContent fetch.
 */
interface ContentResolution {
  /** Locale actually served — may differ from the user's preference. */
  served_locale?: string
  match_kind?: "exact" | "language_match" | "fallback_chain" | "any"
  /** Where the content came from. "synthesized" = thin fallback. */
  source?: "owned" | "sourced-cache" | "sourced-fresh" | "synthesized"
  served_stale?: boolean
  machine_translated?: boolean
}

type ContentResponse<T> = {
  data?: T
  content?: T
} & ContentResolution

/**
 * Build a BCP-47 preference chain from the browser. Sent as
 * `Accept-Language` so the public content endpoints can honor the
 * user's locale preference per §3.5.3.
 */
function getPreferredLocaleHeader(): string {
  if (typeof navigator === "undefined") return "en-GB"
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(
    Boolean,
  )
  return langs.join(",")
}

async function fetchContent<T>(
  url: string,
): Promise<{ content: T; resolution: ContentResolution } | null> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "accept-language": getPreferredLocaleHeader(),
    },
  })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Content request failed: ${res.status}`)
  }
  const json = (await res.json()) as ContentResponse<T>
  const content = json.data ?? json.content
  if (!content) return null
  return {
    content,
    resolution: {
      served_locale: json.served_locale,
      match_kind: json.match_kind,
      source: json.source,
      served_stale: json.served_stale,
      machine_translated: json.machine_translated,
    },
  }
}

/**
 * Catalog detail page — single route serving products / cruises /
 * hospitality. Each vertical renders its own body (itinerary / ship
 * details / property details) and its own sidebar (departure
 * picker / sailing+cabin picker / date-range+room+rate picker).
 *
 * On "Book", the relevant configure fields are serialized into the
 * journey URL so the wizard's Configure step can be hidden.
 */
export const Route = createFileRoute("/(storefront)/shop_/products/$entityModule/$entityId")({
  component: DetailPage,
})

function DetailPage(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/products/$entityModule/$entityId",
  })

  if (entityModule === "cruises") {
    return <CruiseDetailPage entityId={entityId} />
  }
  if (entityModule === "hospitality") {
    return <HospitalityDetailPage entityId={entityId} />
  }
  return <ProductDetailPageProducts entityModule={entityModule} entityId={entityId} />
}

// ─────────────────────────────────────────────────────────────────
// Products vertical
// ─────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  id: string
  dateLocal: string
  startsAt: string
  endsAt?: string | null
  timezone: string
  status: string
  unlimited: boolean
  remainingPax?: number | null
  initialPax?: number | null
  nights?: number | null
  days?: number | null
}

function ProductDetailPageProducts({
  entityModule,
  entityId,
}: {
  entityModule: string
  entityId: string
}): React.ReactElement {
  const navigate = useNavigate()

  const slots = useQuery({
    queryKey: ["public-catalog-slots", entityModule, entityId],
    queryFn: async (): Promise<{ rows: AvailabilitySlot[] }> => {
      const res = await fetch(
        `${getApiUrl()}/v1/public/catalog/slots?entityModule=${encodeURIComponent(entityModule)}&entityId=${encodeURIComponent(entityId)}`,
        { credentials: "include" },
      )
      if (!res.ok) throw new Error(`Slots request failed: ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })

  const content = useQuery({
    queryKey: ["public-product-content", entityModule, entityId],
    queryFn: () =>
      fetchContent<ProductContent>(
        `${getApiUrl()}/v1/public/products/${encodeURIComponent(entityId)}/content`,
      ),
    staleTime: 30_000,
  })

  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined)
  const [adultCount, setAdultCount] = useState(2)
  const [childCount, setChildCount] = useState(0)
  const [infantCount, setInfantCount] = useState(0)

  const firstOpenId = slots.data?.rows[0]?.id
  useEffect(() => {
    if (firstOpenId && !selectedSlotId) setSelectedSlotId(firstOpenId)
  }, [firstOpenId, selectedSlotId])

  const probeDraft = useMemo<BookingDraftV1 | null>(() => {
    if (!selectedSlotId) return null
    return bookingDraftV1.parse({
      entity: { module: entityModule, id: entityId, sourceKind: "" },
      configure: {
        departureSlotId: selectedSlotId,
        pax: { adult: adultCount, child: childCount, infant: infantCount },
      },
    })
  }, [entityModule, entityId, selectedSlotId, adultCount, childCount, infantCount])

  const quote = useBookingQuote({ surface: "public", draft: probeDraft })

  const totalPax = adultCount + childCount + infantCount
  const totalCents = quote.data?.pricing?.total ?? 0
  const currency = quote.data?.pricing?.currency

  return (
    <DetailLayout
      body={
        <ProductDetailBody
          entityModule={entityModule}
          entityId={entityId}
          content={content.data?.content ?? null}
          resolution={content.data?.resolution ?? null}
          isLoading={content.isLoading}
        />
      }
      sidebar={
        <BookingSidebar
          totalPax={totalPax}
          totalCents={totalCents}
          currency={currency}
          isQuoting={quote.isQuoting}
          quoteData={quote.data}
          disabled={!selectedSlotId || totalPax < 1 || quote.data?.available === false}
          onBook={() => {
            if (!selectedSlotId) return
            navigate({
              to: "/shop/book/$entityModule/$entityId",
              params: { entityModule, entityId },
              search: {
                departureSlotId: selectedSlotId,
                adult: adultCount,
                ...(childCount > 0 ? { child: childCount } : {}),
                ...(infantCount > 0 ? { infant: infantCount } : {}),
              } as never,
            })
          }}
        >
          <DepartureSelect
            slots={slots.data?.rows ?? []}
            isLoading={slots.isLoading}
            isError={slots.isError}
            value={selectedSlotId}
            onChange={setSelectedSlotId}
          />
          <PaxBlock
            adult={adultCount}
            child={childCount}
            infant={infantCount}
            setAdult={setAdultCount}
            setChild={setChildCount}
            setInfant={setInfantCount}
          />
        </BookingSidebar>
      }
    />
  )
}

function ProductDetailBody({
  entityModule,
  entityId,
  content,
  resolution,
  isLoading,
}: {
  entityModule: string
  entityId: string
  content: ProductContent | null
  resolution: ContentResolution | null
  isLoading: boolean
}): React.ReactElement {
  if (isLoading) return <BodySkeleton />
  if (!content) return <BodyMissing entityModule={entityModule} entityId={entityId} />

  const heroImage = content.media?.find((m) => m.type === "image")
  const galleryImages = content.media?.filter((m) => m.type === "image").slice(0, 6) ?? []

  return (
    <div className="space-y-4">
      {heroImage ? (
        <HeroImage url={heroImage.url} alt={heroImage.alt ?? content.product.name} />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{content.product.name}</CardTitle>
          <ContentResolutionHint resolution={resolution} />
        </CardHeader>
        <CardContent className="space-y-4">
          {content.product.description ? (
            <p className="whitespace-pre-line text-muted-foreground text-sm">
              {content.product.description}
            </p>
          ) : null}
          {content.product.highlights && content.product.highlights.length > 0 ? (
            <div>
              <div className="mb-2 font-medium text-sm">Highlights</div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {content.product.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <BackLink />
        </CardContent>
      </Card>

      {content.days && content.days.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Itinerary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {content.days.map((day) => (
              <div key={day.day_number} className="space-y-1 border-l-2 pl-4">
                <div className="font-medium text-sm">
                  Day {day.day_number}
                  {day.title ? ` · ${day.title}` : ""}
                  {day.location ? (
                    <span className="text-muted-foreground"> — {day.location}</span>
                  ) : null}
                </div>
                {day.description ? (
                  <p className="text-muted-foreground text-sm">{day.description}</p>
                ) : null}
                {day.services && day.services.length > 0 ? (
                  <ul className="list-disc pl-5 text-muted-foreground text-xs">
                    {day.services.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {galleryImages.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryImages.slice(1).map((img) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt={img.alt ?? content.product.name}
                  className="aspect-square w-full rounded object-cover"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {content.policies && content.policies.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {content.policies.map((p) => (
              <div key={p.kind}>
                <div className="font-medium capitalize">{p.kind.replace(/_/g, " ")}</div>
                {p.body ? (
                  <p className="whitespace-pre-line text-muted-foreground">{p.body}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Cruises vertical
// ─────────────────────────────────────────────────────────────────

function CruiseDetailPage({ entityId }: { entityId: string }): React.ReactElement {
  const navigate = useNavigate()

  const content = useQuery({
    queryKey: ["public-cruise-content", entityId],
    queryFn: () =>
      fetchContent<CruiseContent>(
        `${getApiUrl()}/v1/public/cruises/${encodeURIComponent(entityId)}/content`,
      ),
    staleTime: 30_000,
  })

  const [selectedSailingId, setSelectedSailingId] = useState<string | undefined>(undefined)
  const [selectedCabinCategoryId, setSelectedCabinCategoryId] = useState<string | undefined>(
    undefined,
  )
  const [occupancy, setOccupancy] = useState(2)

  const firstSailingId = content.data?.content.sailings.find((s) => s.status !== "sold_out")?.id
  useEffect(() => {
    if (firstSailingId && !selectedSailingId) setSelectedSailingId(firstSailingId)
  }, [firstSailingId, selectedSailingId])

  const probeDraft = useMemo<BookingDraftV1 | null>(() => {
    if (!selectedSailingId || !selectedCabinCategoryId) return null
    return bookingDraftV1.parse({
      entity: { module: "cruises", id: entityId, sourceKind: "" },
      configure: {
        departureSlotId: selectedSailingId,
        cabinCategoryId: selectedCabinCategoryId,
        pax: { adult: occupancy },
      },
    })
  }, [entityId, selectedSailingId, selectedCabinCategoryId, occupancy])

  const quote = useBookingQuote({ surface: "public", draft: probeDraft })
  const totalCents = quote.data?.pricing?.total ?? 0
  const currency = quote.data?.pricing?.currency

  return (
    <DetailLayout
      body={
        content.isLoading ? (
          <BodySkeleton />
        ) : !content.data ? (
          <BodyMissing entityModule="cruises" entityId={entityId} />
        ) : (
          <CruiseDetailBody
            content={content.data.content}
            resolution={content.data.resolution}
            selectedSailingId={selectedSailingId}
            onSelectSailing={(id) => {
              setSelectedSailingId(id)
              setSelectedCabinCategoryId(undefined)
            }}
            selectedCabinCategoryId={selectedCabinCategoryId}
            onSelectCabinCategory={setSelectedCabinCategoryId}
            occupancy={occupancy}
          />
        )
      }
      sidebar={
        <BookingSidebar
          totalPax={occupancy}
          totalCents={totalCents}
          currency={currency ?? undefined}
          isQuoting={quote.isQuoting}
          quoteData={quote.data}
          disabled={
            !selectedSailingId || !selectedCabinCategoryId || quote.data?.available === false
          }
          onBook={() => {
            if (!selectedSailingId || !selectedCabinCategoryId) return
            navigate({
              to: "/shop/book/$entityModule/$entityId",
              params: { entityModule: "cruises", entityId },
              search: {
                departureSlotId: selectedSailingId,
                cabinCategoryId: selectedCabinCategoryId,
                adult: occupancy,
              } as never,
            })
          }}
        >
          <div className="space-y-3">
            <Label>Occupancy</Label>
            <PaxStepper
              label="Guests in cabin"
              hint="Per-pax pricing"
              value={occupancy}
              setValue={setOccupancy}
              min={1}
              max={4}
            />
          </div>
        </BookingSidebar>
      }
    />
  )
}

function CruiseDetailBody({
  content,
  resolution,
  selectedSailingId,
  onSelectSailing,
  selectedCabinCategoryId,
  onSelectCabinCategory,
  occupancy,
}: {
  content: CruiseContent
  resolution: ContentResolution | null
  selectedSailingId: string | undefined
  onSelectSailing: (id: string) => void
  selectedCabinCategoryId: string | undefined
  onSelectCabinCategory: (id: string) => void
  occupancy: number
}): React.ReactElement {
  return (
    <div className="space-y-4">
      {content.cruise.hero_image_url ? (
        <HeroImage url={content.cruise.hero_image_url} alt={content.cruise.name} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{content.cruise.name}</CardTitle>
          <ContentResolutionHint resolution={resolution} />
        </CardHeader>
        <CardContent className="space-y-3">
          {content.ship?.name ? (
            <div className="text-muted-foreground text-sm">
              Aboard <span className="font-medium">{content.ship.name}</span>
              {content.cruise.duration_nights ? ` · ${content.cruise.duration_nights} nights` : ""}
            </div>
          ) : null}
          {content.cruise.description ? (
            <p className="whitespace-pre-line text-muted-foreground text-sm">
              {content.cruise.description}
            </p>
          ) : null}
          <BackLink />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choose a sailing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground text-xs uppercase">
                  <th className="py-2">Date</th>
                  <th className="py-2">Route</th>
                  <th className="py-2">Nights</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {content.sailings.map((sailing) => {
                  const soldOut = sailing.status === "sold_out"
                  const selected = sailing.id === selectedSailingId
                  return (
                    <tr
                      key={sailing.id}
                      className={`border-b ${selected ? "bg-primary/5" : ""} ${
                        soldOut ? "text-muted-foreground" : "cursor-pointer hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (!soldOut) onSelectSailing(sailing.id)
                      }}
                    >
                      <td className="py-2">{formatSailingDate(sailing.start_date)}</td>
                      <td className="py-2">
                        {sailing.embarkation_port && sailing.disembarkation_port
                          ? `${sailing.embarkation_port} → ${sailing.disembarkation_port}`
                          : (sailing.embarkation_port ?? "—")}
                      </td>
                      <td className="py-2">{sailing.duration_nights ?? "—"}</td>
                      <td className="py-2 text-right">{soldOut ? "Sold out" : "Available"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedSailingId && content.cabin_categories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose a cabin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {content.cabin_categories.map((cat) => {
              const selected = cat.id === selectedCabinCategoryId
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`w-full rounded border p-3 text-left ${
                    selected ? "border-primary ring-2 ring-primary" : ""
                  }`}
                  onClick={() => onSelectCabinCategory(cat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{cat.name}</div>
                      {cat.description ? (
                        <div className="text-muted-foreground text-xs">{cat.description}</div>
                      ) : null}
                      {cat.type ? (
                        <div className="text-muted-foreground text-xs uppercase">{cat.type}</div>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
            <p className="text-muted-foreground text-xs">
              Pricing is per guest at occupancy {occupancy}; the sidebar total reflects the cabin
              charge.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Hospitality vertical
// ─────────────────────────────────────────────────────────────────

function HospitalityDetailPage({ entityId }: { entityId: string }): React.ReactElement {
  const navigate = useNavigate()

  const content = useQuery({
    queryKey: ["public-hospitality-content", entityId],
    queryFn: () =>
      fetchContent<HospitalityContent>(
        `${getApiUrl()}/v1/public/hospitality/${encodeURIComponent(entityId)}/content`,
      ),
    staleTime: 30_000,
  })

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined)
  const [selectedRatePlanId, setSelectedRatePlanId] = useState<string | undefined>(undefined)
  const [adultCount, setAdultCount] = useState(2)
  const [childCount, setChildCount] = useState(0)

  const firstRoomId = content.data?.content.room_types[0]?.id
  useEffect(() => {
    if (firstRoomId && !selectedRoomId) setSelectedRoomId(firstRoomId)
  }, [firstRoomId, selectedRoomId])

  const ratePlansForRoom = useMemo(() => {
    if (!content.data || !selectedRoomId) return []
    return content.data.content.rate_plans.filter(
      (rp) =>
        !rp.applies_to_room_type_ids ||
        rp.applies_to_room_type_ids.length === 0 ||
        rp.applies_to_room_type_ids.includes(selectedRoomId),
    )
  }, [content.data, selectedRoomId])

  useEffect(() => {
    if (ratePlansForRoom.length > 0 && !selectedRatePlanId) {
      setSelectedRatePlanId(ratePlansForRoom[0]?.id)
    }
  }, [ratePlansForRoom, selectedRatePlanId])

  const probeDraft = useMemo<BookingDraftV1 | null>(() => {
    if (!selectedRoomId || !checkIn || !checkOut) return null
    return bookingDraftV1.parse({
      entity: { module: "hospitality", id: entityId, sourceKind: "" },
      configure: {
        dateRange: { checkIn, checkOut },
        pax: { adult: adultCount, child: childCount },
      },
      accommodation: {
        rooms: [
          {
            optionUnitId: selectedRoomId,
            quantity: 1,
            ...(selectedRatePlanId ? { ratePlanId: selectedRatePlanId } : {}),
          },
        ],
        travelerAssignments: {},
      },
    })
  }, [entityId, checkIn, checkOut, selectedRoomId, selectedRatePlanId, adultCount, childCount])

  const quote = useBookingQuote({ surface: "public", draft: probeDraft })
  const totalCents = quote.data?.pricing?.total ?? 0
  const currency = quote.data?.pricing?.currency

  const totalPax = adultCount + childCount
  const datesValid = checkIn && checkOut && new Date(checkOut) > new Date(checkIn)

  return (
    <DetailLayout
      body={
        content.isLoading ? (
          <BodySkeleton />
        ) : !content.data ? (
          <BodyMissing entityModule="hospitality" entityId={entityId} />
        ) : (
          <HospitalityDetailBody
            content={content.data.content}
            resolution={content.data.resolution}
            selectedRoomId={selectedRoomId}
            onSelectRoom={(id) => {
              setSelectedRoomId(id)
              setSelectedRatePlanId(undefined)
            }}
            selectedRatePlanId={selectedRatePlanId}
            onSelectRatePlan={setSelectedRatePlanId}
            ratePlansForRoom={ratePlansForRoom}
          />
        )
      }
      sidebar={
        <BookingSidebar
          totalPax={totalPax}
          totalCents={totalCents}
          currency={currency}
          isQuoting={quote.isQuoting}
          quoteData={quote.data}
          disabled={
            !selectedRoomId ||
            !selectedRatePlanId ||
            !datesValid ||
            totalPax < 1 ||
            quote.data?.available === false
          }
          onBook={() => {
            if (!selectedRoomId || !selectedRatePlanId || !datesValid) return
            navigate({
              to: "/shop/book/$entityModule/$entityId",
              params: { entityModule: "hospitality", entityId },
              search: {
                checkIn,
                checkOut,
                roomTypeId: selectedRoomId,
                ratePlanId: selectedRatePlanId,
                adult: adultCount,
                ...(childCount > 0 ? { child: childCount } : {}),
              } as never,
            })
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="hp-checkin">Check-in</Label>
              <Input
                id="hp-checkin"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hp-checkout">Check-out</Label>
              <Input
                id="hp-checkout"
                type="date"
                min={tomorrow}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          <PaxBlock
            adult={adultCount}
            child={childCount}
            infant={0}
            setAdult={setAdultCount}
            setChild={setChildCount}
            setInfant={() => {}}
            showInfants={false}
          />
        </BookingSidebar>
      }
    />
  )
}

function HospitalityDetailBody({
  content,
  resolution,
  selectedRoomId,
  onSelectRoom,
  selectedRatePlanId,
  onSelectRatePlan,
  ratePlansForRoom,
}: {
  content: HospitalityContent
  resolution: ContentResolution | null
  selectedRoomId: string | undefined
  onSelectRoom: (id: string) => void
  selectedRatePlanId: string | undefined
  onSelectRatePlan: (id: string) => void
  ratePlansForRoom: ReadonlyArray<HospitalityContent["rate_plans"][number]>
}): React.ReactElement {
  return (
    <div className="space-y-4">
      {content.hotel.hero_image_url ? (
        <HeroImage url={content.hotel.hero_image_url} alt={content.hotel.name} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {content.hotel.name}
            {content.hotel.star_rating ? (
              <span className="ml-2 text-amber-500">
                {"★".repeat(Math.floor(content.hotel.star_rating))}
              </span>
            ) : null}
          </CardTitle>
          <ContentResolutionHint resolution={resolution} />
        </CardHeader>
        <CardContent className="space-y-3">
          {content.hotel.description ? (
            <p className="whitespace-pre-line text-muted-foreground text-sm">
              {content.hotel.description}
            </p>
          ) : null}
          <BackLink />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choose a room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {content.room_types.map((room) => {
            const selected = room.id === selectedRoomId
            return (
              <button
                key={room.id}
                type="button"
                className={`w-full rounded border p-3 text-left ${
                  selected ? "border-primary ring-2 ring-primary" : ""
                }`}
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="font-medium">{room.name}</div>
                {room.description ? (
                  <div className="text-muted-foreground text-xs">{room.description}</div>
                ) : null}
                {room.max_occupancy ? (
                  <div className="text-muted-foreground text-xs">
                    Sleeps up to {room.max_occupancy}
                  </div>
                ) : null}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {selectedRoomId && ratePlansForRoom.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rate plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratePlansForRoom.map((plan) => {
              const selected = plan.id === selectedRatePlanId
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`w-full rounded border p-3 text-left ${
                    selected ? "border-primary ring-2 ring-primary" : ""
                  }`}
                  onClick={() => onSelectRatePlan(plan.id)}
                >
                  <div className="font-medium">{plan.name}</div>
                  {plan.description ? (
                    <div className="text-muted-foreground text-xs">{plan.description}</div>
                  ) : null}
                  {plan.cancellation_policy ? (
                    <div className="text-muted-foreground text-xs">
                      Cancellation: {plan.cancellation_policy}
                    </div>
                  ) : null}
                  {plan.inclusions && plan.inclusions.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      Includes: {plan.inclusions.join(", ")}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Shared layout + sidebar
// ─────────────────────────────────────────────────────────────────

function DetailLayout({
  body,
  sidebar,
}: {
  body: React.ReactNode
  sidebar: React.ReactNode
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-3 lg:pb-0">
      <div className="space-y-4 lg:col-span-2">{body}</div>
      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">{sidebar}</aside>
    </div>
  )
}

function BookingSidebar({
  children,
  totalPax,
  totalCents,
  currency,
  isQuoting,
  quoteData,
  disabled,
  onBook,
}: {
  children: React.ReactNode
  totalPax: number
  totalCents: number
  currency: string | undefined
  isQuoting: boolean
  quoteData: { available?: boolean; invalidReason?: string } | null | undefined
  disabled: boolean
  onBook: () => void
}): React.ReactElement {
  const totalLabel =
    totalCents > 0 && currency
      ? formatMoney(totalCents, currency)
      : quoteData?.invalidReason
        ? "—"
        : "Pending"

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Book this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalPax} {totalPax === 1 ? "guest" : "guests"}
            </span>
            {isQuoting && !quoteData ? <Skeleton className="h-4 w-20" /> : null}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Total</span>
            <span className="font-medium text-xl">{totalLabel}</span>
          </div>
          {quoteData?.invalidReason ? (
            <p className="text-amber-600 text-xs">
              {humanizeInvalidReason(quoteData.invalidReason)}
            </p>
          ) : null}
          <Button type="button" className="w-full" disabled={disabled} onClick={onBook}>
            Book
          </Button>
          <p className="text-muted-foreground text-xs">
            You won't be charged yet. The next step collects traveler details.
          </p>
        </CardContent>
      </Card>

      {/* Mobile fixed bottom panel — collapses sidebar on narrow viewports */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 shadow-lg lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-muted-foreground text-xs">
              {totalPax} {totalPax === 1 ? "guest" : "guests"}
            </div>
            <div className="font-medium">{totalLabel}</div>
          </div>
          <Button type="button" disabled={disabled} onClick={onBook}>
            Book
          </Button>
        </div>
      </div>
    </>
  )
}

function DepartureSelect({
  slots,
  isLoading,
  isError,
  value,
  onChange,
}: {
  slots: ReadonlyArray<AvailabilitySlot>
  isLoading: boolean
  isError: boolean
  value: string | undefined
  onChange: (id: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <Label htmlFor="departure-select">Departure</Label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isError ? (
        <p className="text-destructive text-sm">Departures unavailable.</p>
      ) : slots.length === 0 ? (
        <p className="text-muted-foreground text-sm">No upcoming departures.</p>
      ) : (
        <select
          id="departure-select"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatSlotLabel(slot)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function PaxBlock({
  adult,
  child,
  infant,
  setAdult,
  setChild,
  setInfant,
  showInfants = true,
}: {
  adult: number
  child: number
  infant: number
  setAdult: (n: number) => void
  setChild: (n: number) => void
  setInfant: (n: number) => void
  showInfants?: boolean
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <Label>Travelers</Label>
      <PaxStepper label="Adults" hint="12 yrs+" value={adult} setValue={setAdult} min={1} max={8} />
      <PaxStepper
        label="Children"
        hint="2–11 yrs"
        value={child}
        setValue={setChild}
        min={0}
        max={6}
      />
      {showInfants ? (
        <PaxStepper
          label="Infants"
          hint="under 2"
          value={infant}
          setValue={setInfant}
          min={0}
          max={4}
        />
      ) : null}
    </div>
  )
}

function PaxStepper({
  label,
  hint,
  value,
  setValue,
  min,
  max,
}: {
  label: string
  hint: string
  value: number
  setValue: (n: number) => void
  min: number
  max: number
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value <= min}
          onClick={() => setValue(value - 1)}
        >
          −
        </Button>
        <span className="min-w-6 text-center">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value >= max}
          onClick={() => setValue(value + 1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function ContentResolutionHint({
  resolution,
}: {
  resolution: ContentResolution | null
}): React.ReactElement | null {
  if (!resolution) return null
  const hints: string[] = []
  if (resolution.match_kind && resolution.match_kind !== "exact" && resolution.served_locale) {
    hints.push(`Served in ${resolution.served_locale}`)
  }
  if (resolution.machine_translated) {
    hints.push("Machine-translated")
  }
  if (resolution.source === "synthesized") {
    hints.push("Limited content available")
  }
  if (resolution.served_stale) {
    hints.push("Refreshing in the background")
  }
  if (hints.length === 0) return null
  return <div className="text-muted-foreground text-xs">{hints.join(" · ")}</div>
}

function HeroImage({ url, alt }: { url: string; alt: string }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-lg border">
      <img src={url} alt={alt} className="aspect-[16/9] w-full object-cover" />
    </div>
  )
}

function BackLink(): React.ReactElement {
  return (
    <p>
      <Link to="/shop" className="text-sm underline">
        ← Back to all
      </Link>
    </p>
  )
}

function BodySkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

function BodyMissing({
  entityModule,
  entityId,
}: {
  entityModule: string
  entityId: string
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {entityModule} · {entityId}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground text-sm">
        <p>Detail content isn't available for this item yet.</p>
        <BackLink />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function formatSlotLabel(slot: AvailabilitySlot): string {
  const date = new Date(slot.startsAt)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  const duration = slot.nights ? ` · ${slot.nights}n` : slot.days ? ` · ${slot.days}d` : ""
  const capacity = slot.unlimited
    ? ""
    : slot.remainingPax != null
      ? ` · ${slot.remainingPax} left`
      : ""
  return `${dateStr} ${time}${duration}${capacity}`
}

function formatSailingDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function humanizeInvalidReason(reason: string): string {
  switch (reason) {
    case "no_sell_amount_configured":
      return "Pricing isn't configured for this item yet."
    case "product_not_found":
      return "Product not found."
    case "cruise_not_found":
      return "Cruise not found."
    case "property_not_found":
      return "Property not found."
    case "no_price_for_occupancy":
      return "No price for the chosen cabin and occupancy."
    default:
      return reason
  }
}
