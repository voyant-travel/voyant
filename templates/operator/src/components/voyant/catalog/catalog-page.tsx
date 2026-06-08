"use client"

import { Link, useNavigate } from "@tanstack/react-router"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import {
  CatalogBrowsePage,
  createCatalogEnrichmentFetchers,
  type CatalogSlotAvailability as UiCatalogSlotAvailability,
  useCatalogUiMessagesOrDefault,
} from "@voyantjs/catalog-ui"
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

import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { getApiUrl } from "@/lib/env"
import type { CatalogSearchParams, CatalogVerticalPageId } from "./catalog-route-state"

type CatalogBrowserMessages = ReturnType<
  typeof useAdminMessages
>["products"]["operations"]["catalogBrowser"]

const DEFAULT_MARKET_VALUE = "__default__"
const DEFAULT_CATALOG_LOCALE = "en-GB"

interface CatalogVerticalPageProps {
  vertical: CatalogVerticalPageId
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
  /**
   * Embedded under another surface's unified search bar (the Dynamic page).
   * Hides this page's own search box, title and market/locale chrome so there
   * is a single search experience; `search.q` is driven externally.
   */
  embedded?: boolean
  /**
   * Facet filters always applied to this surface, on top of the user's
   * URL-driven filters and never erased by them (e.g. a Scheduled page pins
   * `supplyModel: ["scheduled"]`). Kept out of URL state.
   */
  lockedFacets?: Record<string, Array<string | number>>
  /**
   * Range filters always applied to this surface (e.g. an Excursions page pins
   * `durationDays: { lte: 1 }`). Like {@link lockedFacets}, kept out of URL.
   */
  lockedRanges?: Record<string, { gte?: number; lte?: number }>
  /**
   * Open a result's dedicated detail page (in a new tab) instead of the in-page
   * detail sheet. Each surface passes its own opener so the right detail route
   * is used (packages → its bespoke page; cruises/accommodations/excursions/
   * tours → the generic vertical detail). When omitted, the sheet is used.
   */
  onOpenDetail?: (hit: CatalogSearchHit) => void
}

/**
 * Operator host for the packaged `CatalogBrowsePage` — resolves the operator's
 * markets/locales + supplier directory, builds the detail-enrichment fetchers,
 * renders the market/locale scope controls, and wires booking/editor/tag
 * actions to the router + product mutations. The reusable grid + locked-facet
 * merge live in `@voyantjs/catalog-ui`.
 */
export function CatalogVerticalPage({
  vertical,
  search,
  onSearchChange,
  embedded = false,
  lockedFacets,
  lockedRanges,
  onOpenDetail,
}: CatalogVerticalPageProps) {
  const navigate = useNavigate()
  const browserMessages = useAdminMessages().products.operations.catalogBrowser
  const catalogMessages = useCatalogUiMessagesOrDefault().catalogPage
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
      tags.add(DEFAULT_CATALOG_LOCALE)
    }
    return Array.from(tags).sort((left, right) => left.localeCompare(right))
  }, [localesQuery.data, selectedMarket])
  const fallbackLocale = selectedMarket?.defaultLanguageTag ?? DEFAULT_CATALOG_LOCALE
  const selectedLocale =
    search.locale && localeOptions.includes(search.locale) ? search.locale : fallbackLocale
  const supplierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliersQuery.data?.data ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersQuery.data])
  const formatSupplier = (id: string | number) => supplierMap.get(String(id)) ?? String(id)
  const productMutation = useProductMutation()

  const enrichmentFetchers = useMemo(
    () =>
      createCatalogEnrichmentFetchers({
        baseUrl: getApiUrl(),
        // Route the detail-sheet content fetch to each vertical's content
        // mount (see src/api/catalog-content.ts). Verticals omitted here have
        // no content route mounted, so their sheet renders the projection only.
        contentBasePathByVertical: {
          products: "/v1/admin/products",
          cruises: "/v1/admin/cruises",
          accommodations: "/v1/admin/accommodations",
        },
        formatSupplier: (id) => supplierMap.get(String(id)) ?? String(id),
        locale: selectedLocale,
        market: selectedMarketId,
        loadSlotAvailability: loadProductSlotAvailability,
      }),
    [supplierMap, selectedLocale, selectedMarketId],
  )

  return (
    <CatalogBrowsePage
      vertical={vertical}
      search={search}
      onSearchChange={onSearchChange}
      locale={selectedLocale}
      embedded={embedded}
      lockedFacets={lockedFacets}
      lockedRanges={lockedRanges}
      formatSupplier={formatSupplier}
      enrichmentFetchers={enrichmentFetchers}
      title={
        <div>
          <h1 className="font-semibold text-2xl">{catalogMessages.tabs[vertical]}</h1>
        </div>
      }
      scopeControls={
        <CatalogScopeControls
          messages={browserMessages}
          markets={marketsQuery.data?.data ?? []}
          localeOptions={localeOptions}
          market={selectedMarketId}
          locale={selectedLocale}
          onMarketChange={(marketId) => {
            const nextMarket = (marketsQuery.data?.data ?? []).find(
              (market) => market.id === marketId,
            )
            onSearchChange(
              (prev): CatalogSearchParams => ({
                ...prev,
                market: marketId,
                locale: nextMarket?.defaultLanguageTag,
                page: 1,
              }),
              true,
            )
          }}
          onDefaultMarket={() => {
            onSearchChange(
              (prev): CatalogSearchParams => ({
                ...prev,
                market: undefined,
                locale: undefined,
                page: 1,
              }),
              true,
            )
          }}
          onLocaleChange={(locale) => {
            onSearchChange((prev): CatalogSearchParams => ({ ...prev, locale, page: 1 }), true)
          }}
        />
      }
      onBookHit={(hit, entityModule) =>
        goToBookingPage(hit, entityModule, navigate, browserMessages)
      }
      onBookDeparture={(hit, entityModule, departure) =>
        goToBookingPage(hit, entityModule, navigate, browserMessages, departure)
      }
      onBookOption={(hit, entityModule, departure, option) =>
        goToBookingPage(hit, entityModule, navigate, browserMessages, departure, option)
      }
      onOpenProductEditor={(hit) => navigate({ to: "/products/$id", params: { id: hit.id } })}
      // When the surface provides a detail-page opener, results open it (new
      // tab) instead of the in-page sheet. Surface-specific so each vertical
      // routes to the right detail page.
      onOpenProductDetail={onOpenDetail ? (hit) => onOpenDetail(hit) : undefined}
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
          toast.info(browserMessages.tagsReadOnly)
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
          toast.error(err instanceof Error ? err.message : browserMessages.tagsUpdateFailed)
          throw err
        }
      }}
    />
  )
}

interface CatalogScopeControlsProps {
  messages: CatalogBrowserMessages
  markets: Array<{ id: string; name: string; code: string; defaultLanguageTag: string }>
  localeOptions: string[]
  market?: string
  locale: string
  onMarketChange: (marketId: string) => void
  onDefaultMarket: () => void
  onLocaleChange: (locale: string) => void
}

function CatalogScopeControls({
  messages,
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
          <SelectItem value={DEFAULT_MARKET_VALUE}>{messages.defaultMarket}</SelectItem>
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

interface CatalogSlotsResponse {
  rows: Array<UiCatalogSlotAvailability & { startsAt: string }>
}

function goToBookingPage(
  hit: CatalogSearchHit,
  entityModule: string,
  navigate: AppNavigate,
  messages: CatalogBrowserMessages,
  departure?: BookingDeparture,
  option?: { id: string; name: string },
): void {
  const sourceKind = stringField(hit, "source.kind", null) ?? "owned"
  if (!sourceKind) {
    toast.info(messages.cannotBookYet, {
      description: messages.missingSourceInfo,
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

async function loadProductSlotAvailability(
  productId: string,
): Promise<Map<string, UiCatalogSlotAvailability>> {
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
