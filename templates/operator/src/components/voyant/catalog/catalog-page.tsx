"use client"

import { Link, useNavigate } from "@tanstack/react-router"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { type CatalogDetailEnrichment, CatalogPage as CatalogUiPage } from "@voyantjs/catalog-ui"
import { useMarketLocales, useMarkets } from "@voyantjs/markets-react"
import { useProductMutation } from "@voyantjs/products-react"
import { useSuppliers } from "@voyantjs/suppliers-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { useMemo } from "react"
import { toast } from "sonner"

import type { ProductSourcedContentResponse } from "@/components/voyant/products/product-detail-shared"
import { ApiError, api } from "@/lib/api-client"
import { type CatalogSearchParams, Route } from "@/routes/_workspace/catalog"

const DEFAULT_MARKET_VALUE = "__default__"

export function CatalogPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const suppliersQuery = useSuppliers({ limit: 100 })
  const marketsQuery = useMarkets({ status: "active", limit: 100 })
  const selectedMarketId = search.market
  const selectedMarket = (marketsQuery.data?.data ?? []).find(
    (market) => market.id === selectedMarketId,
  )
  const localesQuery = useMarketLocales({
    marketId: selectedMarketId,
    active: true,
    limit: 100,
    enabled: Boolean(selectedMarketId),
  })
  const localeOptions = useMemo(() => {
    const tags = new Set<string>()
    if (selectedMarket) {
      tags.add(selectedMarket.defaultLanguageTag)
      for (const locale of localesQuery.data?.data ?? []) tags.add(locale.languageTag)
    } else {
      tags.add(search.locale ?? "en-GB")
      for (const market of marketsQuery.data?.data ?? []) tags.add(market.defaultLanguageTag)
    }
    return Array.from(tags).sort((left, right) => left.localeCompare(right))
  }, [localesQuery.data, marketsQuery.data, search.locale, selectedMarket])
  const selectedLocale = search.locale ?? selectedMarket?.defaultLanguageTag ?? "en-GB"
  const supplierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliersQuery.data?.data ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersQuery.data])
  const formatSupplier = (id: string | number) => supplierMap.get(String(id)) ?? String(id)
  const productMutation = useProductMutation()

  return (
    <CatalogUiPage
      search={{ ...search, locale: selectedLocale }}
      formatSupplier={formatSupplier}
      toolbarEnd={
        <CatalogScopeControls
          markets={marketsQuery.data?.data ?? []}
          localeOptions={localeOptions}
          market={selectedMarketId}
          locale={selectedLocale}
          onMarketChange={(marketId) => {
            const nextMarket = (marketsQuery.data?.data ?? []).find(
              (market) => market.id === marketId,
            )
            void routeNavigate({
              search: (prev): CatalogSearchParams => ({
                ...prev,
                market: marketId,
                locale: nextMarket?.defaultLanguageTag,
                page: 1,
              }),
              replace: true,
            })
          }}
          onDefaultMarket={() => {
            void routeNavigate({
              search: (prev): CatalogSearchParams => ({
                ...prev,
                market: undefined,
                locale: undefined,
                page: 1,
              }),
              replace: true,
            })
          }}
          onLocaleChange={(locale) => {
            void routeNavigate({
              search: (prev): CatalogSearchParams => ({ ...prev, locale, page: 1 }),
              replace: true,
            })
          }}
        />
      }
      onTabChange={(id) =>
        routeNavigate({
          search: (prev): CatalogSearchParams => ({ ...prev, tab: id, page: 1 }),
          replace: false,
        })
      }
      onQueryChange={(q) =>
        routeNavigate({
          search: (prev): CatalogSearchParams => ({
            ...prev,
            q: q.length > 0 ? q : undefined,
            page: 1,
          }),
          replace: true,
        })
      }
      onPageChange={(p) =>
        routeNavigate({
          search: (prev): CatalogSearchParams => ({ ...prev, page: p }),
          replace: true,
        })
      }
      onBookHit={(hit, entityModule) => goToBookingPage(hit, entityModule, navigate)}
      onBookDeparture={(hit, entityModule, departure) =>
        goToBookingPage(hit, entityModule, navigate, departure)
      }
      onBookOption={(hit, entityModule, departure, option) =>
        goToBookingPage(hit, entityModule, navigate, departure, option)
      }
      onOpenProductEditor={(hit) => navigate({ to: "/products/$id", params: { id: hit.id } })}
      onLoadProductDetail={(hit) => loadProductDetail(hit, formatSupplier)}
      renderSupplierLink={(supplierId, displayName) => (
        <Link
          to="/suppliers/$id"
          params={{ id: supplierId }}
          className="font-medium text-primary hover:underline"
        >
          {displayName}
        </Link>
      )}
      onTagsChange={async (hit, nextTags) => {
        // Owned products only — sourced rows are read-only mirrors of
        // the upstream so we can't write tags through to them.
        const sourceKind = stringField(hit, "source.kind", null)
        if (sourceKind && sourceKind !== "owned") {
          toast.info("Tags can only be edited on owned products.")
          throw new Error("read-only source kind")
        }
        try {
          await productMutation.update.mutateAsync({
            id: hit.id,
            input: { tags: nextTags },
          })
          // Intentionally don't invalidate the catalog search query —
          // Typesense reindex is async, so a refetch right after the
          // PATCH would return the pre-mutation tags and clobber the
          // local optimistic state. The editor keeps its own working
          // set keyed on hit.id; the next time the user opens this
          // product the index has caught up.
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not update tags.")
          throw err
        }
      }}
    />
  )
}

interface CatalogScopeControlsProps {
  markets: Array<{ id: string; name: string; code: string; defaultLanguageTag: string }>
  localeOptions: string[]
  market?: string
  locale: string
  onMarketChange: (marketId: string) => void
  onDefaultMarket: () => void
  onLocaleChange: (locale: string) => void
}

function CatalogScopeControls({
  markets,
  localeOptions,
  market,
  locale,
  onMarketChange,
  onDefaultMarket,
  onLocaleChange,
}: CatalogScopeControlsProps) {
  return (
    <>
      <Select
        value={market ?? DEFAULT_MARKET_VALUE}
        onValueChange={(value) => {
          if (!value) return
          value === DEFAULT_MARKET_VALUE ? onDefaultMarket() : onMarketChange(value)
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_MARKET_VALUE}>Default market</SelectItem>
          {markets.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name} · {item.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={locale} onValueChange={(value) => value && onLocaleChange(value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {localeOptions.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

type AppNavigate = ReturnType<typeof useNavigate>

interface BookingDeparture {
  id: string
  startsAt: string
}

interface CatalogSlotAvailability {
  id: string
  startsAt: string
  status: string
  unlimited: boolean
  remainingPax: number | null
  initialPax: number | null
}

interface CatalogSlotsResponse {
  rows: CatalogSlotAvailability[]
}

function goToBookingPage(
  hit: CatalogSearchHit,
  entityModule: string,
  navigate: AppNavigate,
  departure?: BookingDeparture,
  option?: { id: string; name: string },
): void {
  const sourceKind = stringField(hit, "source.kind", null) ?? "owned"
  if (!sourceKind) {
    toast.info("This catalog row cannot be booked yet.", {
      description: "The catalog record is missing source information.",
    })
    return
  }

  const sourceRef = stringField(hit, "source.ref", null) ?? undefined
  const sourceConnectionId = stringField(hit, "source.connectionId", null) ?? undefined
  navigate({
    to: "/catalog/journey/$entityModule/$entityId",
    params: { entityModule, entityId: hit.id },
    search: {
      sourceKind,
      ...(sourceConnectionId ? { sourceConnectionId } : {}),
      ...(sourceRef ? { sourceRef } : {}),
      ...(departure ? { departureId: departure.id } : {}),
      ...(option ? { optionId: option.id } : {}),
    },
  })
}

async function loadProductDetail(
  hit: CatalogSearchHit,
  formatSupplier: (id: string | number) => string,
): Promise<CatalogDetailEnrichment | null> {
  let response: ProductSourcedContentResponse | null = null
  try {
    response = await api.get<ProductSourcedContentResponse>(`/v1/admin/products/${hit.id}/content`)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 503)) return null
    throw err
  }

  const {
    content,
    served_locale,
    match_kind,
    source,
    served_stale,
    synthesized,
    machine_translated,
  } = response.data
  const supplierName =
    typeof content.product.supplier === "string"
      ? formatSupplier(content.product.supplier)
      : (content.product.supplier ?? null)
  const availabilityById = await loadProductSlotAvailability(hit.id)

  return {
    description: content.product.description ?? null,
    highlights: content.product.highlights ?? [],
    heroImageUrl: content.product.hero_image_url ?? null,
    supplier: supplierName,
    itinerary: content.days.map((d) => ({
      dayNumber: d.day_number,
      title: d.title ?? null,
      description: d.description ?? null,
      location: d.location ?? null,
      heroImageUrl: d.hero_image_url ?? null,
    })),
    media: content.media.map((m) => ({
      url: m.url,
      type: m.type,
      caption: m.caption ?? null,
    })),
    options: content.options.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description ?? null,
    })),
    policies: content.policies.map((p) => ({ kind: p.kind, body: p.body })),
    departures: (content.departures ?? []).map((d) => ({
      id: d.id,
      startsAt: d.starts_at,
      endsAt: d.ends_at ?? null,
      status: availabilityById.get(d.id)?.status ?? d.status ?? null,
      unlimited: availabilityById.get(d.id)?.unlimited ?? null,
      capacity: availabilityById.get(d.id)?.initialPax ?? d.capacity ?? null,
      remaining: availabilityById.get(d.id)?.remainingPax ?? d.remaining ?? null,
      lowestPriceCents: d.lowest_price_cents ?? null,
      currency: d.currency ?? null,
      note: d.note ?? null,
    })),
    servedLocale: served_locale,
    matchKind: match_kind,
    source,
    servedStale: served_stale,
    synthesized,
    machineTranslated: machine_translated,
  }
}

async function loadProductSlotAvailability(
  productId: string,
): Promise<Map<string, CatalogSlotAvailability>> {
  try {
    const response = await api.get<CatalogSlotsResponse>(
      `/v1/admin/catalog/slots?entityModule=products&entityId=${encodeURIComponent(productId)}`,
    )
    return new Map(response.rows.map((slot) => [slot.id, slot]))
  } catch {
    return new Map()
  }
}

function stringField<T>(hit: CatalogSearchHit, key: string, fallback: T): string | T {
  const v = hit.document.fields[key]
  return typeof v === "string" && v.length > 0 ? v : fallback
}
