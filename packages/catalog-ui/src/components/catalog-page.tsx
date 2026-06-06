"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import { Image as ImageIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useMemo } from "react"

import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogCardConfig } from "./catalog-card.js"
import type {
  CatalogDetailEnrichment,
  CatalogDetailRenderSlot,
  CatalogDetailSheetProps,
} from "./catalog-detail-sheet.js"
import type { CatalogEnrichmentFetchers } from "./catalog-enrichment-fetchers.js"
import {
  asNumber,
  asString,
  asStringArray,
  formatHitPrice,
  numberField,
  stringField,
} from "./catalog-hit.js"
import {
  type CatalogFilterField,
  type CatalogFilterSelections,
  CatalogSearchPage,
  type CatalogSearchTab,
  type CatalogSortOption,
} from "./catalog-search-page.js"

export interface CatalogPageSearchState {
  tab?: string
  q?: string
  page?: number
  market?: string
  locale?: string
  view?: "grid" | "list"
  sort?: CatalogSortOption
  filters?: CatalogFilterSelections
}

export interface CatalogPageProps {
  search?: CatalogPageSearchState
  onTabChange?: (tabId: string) => void
  onQueryChange?: (query: string) => void
  onPageChange?: (page: number) => void
  onViewChange?: (view: "grid" | "list") => void
  onSortChange?: (sort: CatalogSortOption) => void
  onFiltersChange?: (filters: CatalogFilterSelections) => void
  toolbarEnd?: ReactNode
  formatSupplier?: (id: string | number) => string
  onBookHit?: (hit: CatalogSearchHit, entityModule: string) => void
  onBookDeparture?: (
    hit: CatalogSearchHit,
    entityModule: string,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
  ) => void
  onBookOption?: (
    hit: CatalogSearchHit,
    entityModule: string,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
    option: NonNullable<CatalogDetailEnrichment["options"]>[number],
  ) => void
  onOpenProductEditor?: (hit: CatalogSearchHit) => void
  /**
   * Open the full, URL-addressable detail page for a result (e.g. in a new
   * tab) instead of the in-page detail sheet. Bound per vertical and passed
   * the clicked hit + its vertical; return nothing. Provide it only for
   * verticals that have a dedicated detail page — others keep the sheet.
   */
  onOpenProductDetail?: (hit: CatalogSearchHit, vertical: string) => void
  /**
   * Explicit detail-enrichment callback. When set, takes precedence over
   * `enrichmentFetchers` — pass this when you need full control over the
   * request (auth headers, locale resolution, side-channel data). The
   * default integration uses `enrichmentFetchers` for the common case.
   */
  onLoadProductDetail?: (
    hit: CatalogSearchHit,
    vertical?: string,
  ) => Promise<CatalogDetailEnrichment | null>
  /**
   * Declarative detail-enrichment fetchers. Build with
   * `createCatalogEnrichmentFetchers({ baseUrl, … })`. When provided
   * (and `onLoadProductDetail` is not), the detail sheet calls
   * `fetchers.loadProductDetail` on open. This is the recommended way
   * to wire up the sheet — it pins the route contract with
   * `createProductContentRoutes` so a missing server-side mount is
   * caught immediately instead of rendering an empty sheet.
   */
  enrichmentFetchers?: CatalogEnrichmentFetchers
  detailSheetWidth?: CatalogDetailSheetProps["width"]
  detailHeaderExtras?: CatalogDetailSheetProps["headerExtras"]
  renderDetailBrochure?: CatalogDetailRenderSlot
  renderDetailMedia?: CatalogDetailRenderSlot
  renderDetailItineraryDay?: CatalogDetailSheetProps["renderItineraryDay"]
  renderDetailExtraSections?: CatalogDetailRenderSlot
  /**
   * Renders the supplier value in the detail sheet's Attributes tab as
   * a clickable link to the supplier record. Templates wire this with
   * their router's `Link` component. When omitted, the supplier shows
   * as plain text (the resolved supplier name via `formatSupplier`).
   */
  renderSupplierLink?: CatalogDetailSheetProps["renderSupplierLink"]
  /**
   * Inline tags editor for the detail sheet. When set, the Tags row in
   * the Overview tab becomes editable; the callback persists the next
   * tag list (e.g. a product PATCH). Owned products only on the
   * operator side — sourced rows pass through without an editor.
   */
  onTagsChange?: CatalogDetailSheetProps["onTagsChange"]
  /**
   * Restrict the page to one catalog vertical and hide the vertical tab
   * switcher. Use this when routing owns the vertical selection.
   */
  vertical?: string
  title?: ReactNode
  className?: string
  /**
   * Hide the built-in search input. Use when an embedding surface provides its
   * own unified search box and drives `search.q`/`onQueryChange` externally.
   */
  hideSearchInput?: boolean
}

export function CatalogPage({
  search = {},
  onTabChange,
  onQueryChange,
  onPageChange,
  onViewChange,
  onSortChange,
  onFiltersChange,
  toolbarEnd,
  hideSearchInput,
  formatSupplier = (id) => String(id),
  onBookHit,
  onBookDeparture,
  onBookOption,
  onOpenProductEditor,
  onOpenProductDetail,
  onLoadProductDetail,
  enrichmentFetchers,
  detailSheetWidth,
  detailHeaderExtras,
  renderDetailBrochure,
  renderDetailMedia,
  renderDetailItineraryDay,
  renderDetailExtraSections,
  renderSupplierLink,
  onTagsChange,
  vertical,
  title,
  className,
}: CatalogPageProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage
  const resolvedLoadProductDetail = useMemo(
    () => onLoadProductDetail ?? enrichmentFetchers?.loadProductDetail,
    [onLoadProductDetail, enrichmentFetchers],
  )
  // Each tab binds the loader to its vertical so the detail sheet fetches
  // from the right content route (e.g. cruises → /v1/admin/cruises). Without
  // this, only the products tab loaded enrichment and every other vertical's
  // sheet rendered the bare projection.
  const detailLoaderFor = (vertical: string) =>
    resolvedLoadProductDetail
      ? (hit: CatalogSearchHit) => resolvedLoadProductDetail(hit, vertical)
      : undefined
  // Open the dedicated detail page (e.g. new tab), bound per vertical. Only
  // verticals with a real detail page get it; the rest fall back to the sheet.
  const detailOpenerFor = (vertical: string) =>
    onOpenProductDetail ? (hit: CatalogSearchHit) => onOpenProductDetail(hit, vertical) : undefined
  // Lazy per-cabin pricing loader, bound per vertical (cruises only today).
  const loadDeparturePricing = enrichmentFetchers?.loadDeparturePricing
  const departurePricingLoaderFor = (vertical: string) =>
    loadDeparturePricing
      ? (hit: CatalogSearchHit, sailingRef: string) =>
          loadDeparturePricing(hit, sailingRef, vertical)
      : undefined
  const supplierFormatter = (value: unknown) =>
    typeof value === "string" ? formatSupplier(value) : String(value ?? "")
  const sourceKindFormatter = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? formatSourceKind(value, messages)
      : String(value ?? "")

  const tabs: CatalogSearchTab[] = [
    {
      id: "products",
      label: messages.tabs.products,
      vertical: "products",
      columns: makeProductColumns(formatSupplier, messages),
      filterFields: makeProductFilters(formatSupplier, messages),
      card: makeProductCard(formatSupplier, messages),
      sorts: ["price-asc", "price-desc", "departure-asc", "newest"],
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      detailActions: [
        ...(onBookHit
          ? [
              {
                label: messages.actions.bookThis,
                onClick: (hit: CatalogSearchHit) => onBookHit(hit, "products"),
              },
            ]
          : []),
        ...(onOpenProductEditor
          ? [
              {
                label: messages.actions.openEditor,
                onClick: onOpenProductEditor,
                visible: (hit: CatalogSearchHit) => {
                  const kind = stringField(hit, "source.kind", null)
                  // Owned products are the only ones that have an editor —
                  // sourced rows are read-only mirrors of the upstream.
                  return kind === "owned" || kind == null
                },
              },
            ]
          : []),
      ],
      onLoadDetail: detailLoaderFor("products"),
      onBookDeparture: onBookDeparture
        ? (hit, departure) => onBookDeparture(hit, "products", departure)
        : undefined,
      onBookOption: onBookOption
        ? (hit, departure, option) => onBookOption(hit, "products", departure, option)
        : undefined,
    },
    {
      id: "extras",
      label: messages.tabs.extras,
      vertical: "extras",
      columns: makeExtraColumns(formatSupplier, messages),
      filterFields: makeExtraFilters(formatSupplier, messages),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      onLoadDetail: detailLoaderFor("extras"),
    },
    {
      id: "cruises",
      label: messages.tabs.cruises,
      vertical: "cruises",
      columns: makeCruiseColumns(formatSupplier, messages),
      filterFields: makeCruiseFilters(formatSupplier, messages),
      imageField: "thumbnailUrl",
      card: makeCruiseCard(formatSupplier, messages),
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      onLoadDetail: detailLoaderFor("cruises"),
      onLoadDeparturePricing: departurePricingLoaderFor("cruises"),
    },
    {
      id: "charters",
      label: messages.tabs.charters,
      vertical: "charters",
      columns: makeCharterColumns(formatSupplier, messages),
      filterFields: makeCharterFilters(formatSupplier, messages),
      imageField: "heroImageUrl",
      card: makeCharterCard(formatSupplier),
      sorts: ["price-asc", "price-desc", "newest"],
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      onLoadDetail: detailLoaderFor("charters"),
    },
    {
      id: "accommodations",
      label: messages.tabs.accommodations,
      vertical: "accommodations",
      columns: makeAccommodationColumns(formatSupplier, messages),
      filterFields: makeAccommodationFilters(formatSupplier, messages),
      card: makeAccommodationCard(formatSupplier),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      onLoadDetail: detailLoaderFor("accommodations"),
    },
  ]
  // Bind the new-tab detail opener per vertical on every tab — when the host
  // provides `onOpenProductDetail`, results open the dedicated detail page
  // (new tab) instead of the in-page sheet, for whichever vertical is shown.
  const tabsWithDetail = tabs.map((tab) => ({
    ...tab,
    onOpenDetail: detailOpenerFor(tab.vertical),
  }))
  const visibleTabs = vertical
    ? tabsWithDetail.filter((tab) => tab.id === vertical || tab.vertical === vertical)
    : tabsWithDetail
  const activeTab = vertical ? visibleTabs[0]?.id : (search.tab ?? tabs[0]?.id)

  return (
    <div className={cn("mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8", className)}>
      <CatalogSearchPage
        tabs={visibleTabs}
        activeTab={activeTab}
        onActiveTabChange={(id) => {
          if (!vertical) onTabChange?.(id)
        }}
        showTabs={!vertical}
        hideSearchInput={hideSearchInput}
        query={search.q ?? ""}
        onQueryChange={(q) => onQueryChange?.(q)}
        page={search.page ?? 1}
        onPageChange={(p) => onPageChange?.(p)}
        view={search.view}
        onViewChange={onViewChange}
        sort={search.sort}
        onSortChange={onSortChange}
        filters={search.filters}
        onFiltersChange={onFiltersChange}
        market={search.market}
        locale={search.locale}
        toolbarEnd={toolbarEnd}
        detailSheetWidth={detailSheetWidth}
        detailHeaderExtras={detailHeaderExtras}
        renderDetailBrochure={renderDetailBrochure}
        renderDetailMedia={renderDetailMedia}
        renderDetailItineraryDay={renderDetailItineraryDay}
        renderDetailExtraSections={renderDetailExtraSections}
        renderSupplierLink={renderSupplierLink}
        onTagsChange={onTagsChange}
        title={
          title ?? (
            <div>
              <h1 className="font-semibold text-2xl">{messages.title}</h1>
              <p className="text-muted-foreground text-sm">{messages.description}</p>
            </div>
          )
        }
        searchPlaceholder={messages.searchPlaceholder}
      />
    </div>
  )
}

type CatalogPageMessages = ReturnType<typeof useCatalogUiMessagesOrDefault>["catalogPage"]

function makeProductColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    nameColumn(messages.fallbacks.productName, messages),
    statusColumn(messages),
    sourceColumn(messages),
    lookupColumn("supplierId", messages.columns.supplier, formatSupplier, messages),
    daysColumn(messages),
    nightsColumn(messages),
    priceColumn("sellAmountCents", "sellCurrency", messages.columns.price, messages),
  ]
}

function makeExtraColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    nameColumn(messages.fallbacks.extraName, messages),
    activeColumn(messages),
    sourceColumn(messages),
    lookupColumn("supplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("selectionType", messages.columns.selection, messages),
    textColumn("pricingMode", messages.columns.pricing, messages),
    textColumn("defaultQuantity", messages.columns.defaultQuantity, messages),
  ]
}

function makeCruiseColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    nameColumn(messages.fallbacks.cruiseName, messages),
    statusColumn(messages),
    sourceColumn(messages),
    textColumn("cruiseType", messages.columns.type, messages),
    lookupColumn("lineSupplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("nights", messages.columns.nights, messages),
    priceColumn(
      "lowestPriceCached",
      "lowestPriceCurrencyCached",
      messages.columns.price,
      messages,
      "major",
    ),
  ]
}

function makeCharterColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    nameColumn(messages.fallbacks.charterName, messages, "heroImageUrl"),
    statusColumn(messages),
    sourceColumn(messages),
    lookupColumn("lineSupplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("defaultYachtId", messages.columns.yacht, messages),
    priceColumn(
      "lowestPriceCachedAmount",
      "lowestPriceCachedCurrency",
      messages.columns.from,
      messages,
    ),
  ]
}

function makeAccommodationColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    nameColumn(messages.fallbacks.roomName, messages),
    activeColumn(messages),
    sourceColumn(messages),
    lookupColumn("supplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("roomClass", messages.columns.class, messages),
    textColumn("maxOccupancy", messages.columns.maxPax, messages),
    textColumn("bedroomCount", messages.columns.bedrooms, messages),
  ]
}

function makeProductFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "status", label: messages.filters.status },
    { field: "countryCodes", label: messages.filters.country, formatValue: formatCountry },
    { field: "destinations", label: messages.filters.destination },
    {
      field: "board",
      label: messages.filters.board,
      formatValue: (value) => formatBoard(String(value)) ?? String(value),
    },
    {
      field: "stars",
      label: messages.filters.stars,
      formatValue: (value) => formatStars(value) ?? String(value),
      // Show 5★ → 0, not by item count.
      sortValues: "value-desc",
    },
    {
      field: "transport",
      label: messages.filters.transport,
      formatValue: (value) => formatTransport(String(value), messages) ?? String(value),
    },
    {
      field: "source.kind",
      label: messages.filters.source,
      formatValue: (value) => formatSourceKind(value, messages),
    },
    { field: "supplierId", label: messages.filters.supplier, formatValue: formatSupplier },
    { field: "bookingMode", label: messages.filters.bookingMode },
    { field: "productTypeId", label: messages.filters.type },
    { field: "capacityMode", label: messages.filters.capacity },
    { field: "visibility", label: messages.filters.visibility },
    { field: "facilityId", label: messages.filters.facility },
    {
      kind: "range",
      field: "sellAmountCents",
      label: messages.filters.price,
      format: "currency",
      currency: "EUR",
      step: 100,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
    {
      kind: "range",
      field: "pax",
      label: messages.filters.pax,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
  ]
}

function makeExtraFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "active", label: messages.filters.active },
    {
      field: "source.kind",
      label: messages.filters.source,
      formatValue: (value) => formatSourceKind(value, messages),
    },
    { field: "supplierId", label: messages.filters.supplier, formatValue: formatSupplier },
    { field: "selectionType", label: messages.filters.selection },
    { field: "pricingMode", label: messages.filters.pricingMode },
    { field: "pricedPerPerson", label: messages.filters.perPerson },
    {
      kind: "range",
      field: "minQuantity",
      label: messages.filters.minQuantity,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
    {
      kind: "range",
      field: "maxQuantity",
      label: messages.filters.maxQuantity,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
  ]
}

function makeCruiseFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "status", label: messages.filters.status },
    {
      field: "source.kind",
      label: messages.filters.source,
      formatValue: (value) => formatSourceKind(value, messages),
    },
    { field: "cruiseType", label: messages.filters.type },
    {
      // Departure month/year facet — `YYYY-MM` values sorted chronologically,
      // shown as "Mar 2027".
      field: "departureMonths",
      label: messages.filters.departureMonth,
      formatValue: formatDepartureMonth,
      sortValues: "value-asc",
    },
    { field: "lineSupplierId", label: messages.filters.supplier, formatValue: formatSupplier },
    { field: "defaultShipId", label: messages.filters.ship },
    { field: "embarkPortFacilityId", label: messages.filters.embark },
    { field: "disembarkPortFacilityId", label: messages.filters.disembark },
    { field: "regions", label: messages.filters.region },
    { field: "themes", label: messages.filters.theme },
    {
      kind: "range",
      field: "nights",
      label: messages.filters.nights,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
  ]
}

function makeCharterFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "status", label: messages.filters.status },
    {
      field: "source.kind",
      label: messages.filters.source,
      formatValue: (value) => formatSourceKind(value, messages),
    },
    { field: "lineSupplierId", label: messages.filters.supplier, formatValue: formatSupplier },
    { field: "defaultYachtId", label: messages.filters.yacht },
    { field: "defaultBookingModes", label: messages.filters.bookingMode },
    { field: "regions", label: messages.filters.region },
    { field: "themes", label: messages.filters.theme },
    {
      kind: "range",
      field: "lowestPriceCachedAmount",
      label: messages.filters.price,
      format: "currency",
      currency: "EUR",
      step: 100,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
    {
      kind: "range",
      field: "defaultApaPercent",
      label: messages.filters.apaPercent,
      step: 1,
      minPlaceholder: "0",
      maxPlaceholder: "100",
    },
  ]
}

function makeAccommodationFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "active", label: messages.filters.active },
    {
      field: "source.kind",
      label: messages.filters.source,
      formatValue: (value) => formatSourceKind(value, messages),
    },
    { field: "supplierId", label: messages.filters.supplier, formatValue: formatSupplier },
    { field: "inventoryMode", label: messages.filters.inventory },
    { field: "roomClass", label: messages.filters.class },
    { field: "smokingAllowed", label: messages.filters.smoking },
    { field: "propertyId", label: messages.filters.property },
    {
      kind: "range",
      field: "maxOccupancy",
      label: messages.filters.maxPax,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
    {
      kind: "range",
      field: "bedroomCount",
      label: messages.filters.bedrooms,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
    {
      kind: "range",
      field: "bathroomCount",
      label: messages.filters.bathrooms,
      minPlaceholder: "0",
      maxPlaceholder: messages.filters.any,
    },
  ]
}

function nameColumn(
  fallback: string,
  messages: CatalogPageMessages,
  urlField = "thumbnailUrl",
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "name",
    header: messages.columns.name,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <CatalogThumbnail hit={row.original} urlField={urlField} />
        <span className="font-medium">{stringField(row.original, "name", fallback)}</span>
      </div>
    ),
  }
}

function statusColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "status",
    header: messages.columns.status,
    cell: ({ row }) => {
      const status = stringField(row.original, "status", null)
      if (!status) return null
      return (
        <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
          {status}
        </Badge>
      )
    },
  }
}

function activeColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "active",
    header: messages.columns.active,
    cell: ({ row }) => {
      const v = stringField(row.original, "active", null)
      if (v == null) return null
      const isActive = v === "true" || v === "1"
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? messages.values.active : messages.values.inactive}
        </Badge>
      )
    },
  }
}

function textColumn(
  field: string,
  header: string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: field,
    header,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {stringField(row.original, field, messages.values.empty)}
      </span>
    ),
  }
}

function daysColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "durationDays",
    header: messages.columns.days,
    cell: ({ row }) => {
      const days = numberField(row.original, "durationDays")
      if (days == null)
        return <span className="text-muted-foreground">{messages.values.empty}</span>
      return <span className="tabular-nums">{days}</span>
    },
  }
}

function nightsColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "nights",
    header: messages.columns.nights,
    cell: ({ row }) => {
      const days = numberField(row.original, "durationDays")
      if (days == null || days < 1)
        return <span className="text-muted-foreground">{messages.values.empty}</span>
      return <span className="tabular-nums">{Math.max(0, days - 1)}</span>
    },
  }
}

function sourceColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "source.kind",
    header: messages.columns.source,
    cell: ({ row }) => {
      const kind = stringField(row.original, "source.kind", null)
      if (!kind) return <span className="text-muted-foreground">{messages.values.empty}</span>
      return (
        <Badge variant={kind === "owned" ? "secondary" : "outline"}>
          {formatSourceKind(kind, messages)}
        </Badge>
      )
    },
  }
}

function formatSourceKind(value: unknown, messages: CatalogPageMessages): string {
  const raw = String(value)
  const known: Record<string, string> = {
    owned: messages.sourceKinds.owned,
    "voyant-connect": messages.sourceKinds.voyantConnect,
    manual: messages.sourceKinds.manual,
    "gds:amadeus": messages.sourceKinds.gdsAmadeus,
    "gds:sabre": messages.sourceKinds.gdsSabre,
    "gds:travelport": messages.sourceKinds.gdsTravelport,
    "bedbank:hotelbeds": messages.sourceKinds.bedbankHotelbeds,
    "bedbank:expedia": messages.sourceKinds.bedbankExpedia,
  }
  if (known[raw]) return known[raw]
  if (raw.startsWith("direct:")) {
    return `${raw.slice("direct:".length).toUpperCase()} ${messages.sourceKinds.directSuffix}`
  }
  return raw
    .split(/[:\-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}

function lookupColumn(
  field: string,
  header: string,
  format: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: field,
    header,
    cell: ({ row }) => {
      const id = stringField(row.original, field, null)
      if (!id) return <span className="text-muted-foreground">{messages.values.empty}</span>
      return <span>{format(id)}</span>
    },
  }
}

function priceColumn(
  amountField: string,
  currencyField: string,
  header: string,
  messages: CatalogPageMessages,
  unit: "minor" | "major" = "minor",
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: amountField,
    header,
    cell: ({ row }) => {
      const formatted = formatHitPrice(row.original, amountField, currencyField, unit)
      return (
        <span className="font-medium">
          {formatted ?? <span className="text-muted-foreground">{messages.values.empty}</span>}
        </span>
      )
    },
  }
}

function CatalogThumbnail({ hit, urlField }: { hit: CatalogSearchHit; urlField: string }) {
  const url = stringField(hit, urlField, null)
  const name = stringField(hit, "name", "")

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-md object-cover"
        loading="lazy"
      />
    )
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <ImageIcon className="h-4 w-4" />
    </div>
  )
}

// Card configs ─────────────────────────────────────────────────────────────
// Each vertical's merchandising card is a declarative projection of indexed
// fields (no extra fetch). The grid view renders `CatalogCard` from these.

function makeProductCard(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogCardConfig {
  return {
    imageField: "thumbnailUrl",
    // Prefer the computed lowest price; fall back to the headline sell price.
    priceAmountField: ["priceFromAmountCents", "priceFromAmountMinor", "sellAmountCents"],
    priceCurrencyField: ["priceFromCurrency", "sellCurrency"],
    subtitle: productSubtitle,
    meta: (fields) => durationMeta(fields, messages),
    footerNote: (fields) => departureNote(fields, messages),
    // Transport + board basis lead the chips, then categories/themes.
    chips: (fields) =>
      [
        formatTransport(asString(fields.transport), messages),
        formatBoard(asString(fields.board)),
        ...asStringArray(fields.categories),
      ]
        .filter((v): v is string => Boolean(v))
        .slice(0, 3),
    badges: (fields) => supplierBadge(fields, "supplierId", formatSupplier),
  }
}

/** Product card subtitle: star rating + location (e.g. "4.5★ · Belek · Turkey"). */
function productSubtitle(fields: Record<string, unknown>): string | null {
  const parts = [formatStars(fields.stars), locationSubtitle(fields)].filter((v): v is string =>
    Boolean(v),
  )
  return parts.length > 0 ? parts.join(" · ") : null
}

const BOARD_LABELS: Record<string, string> = {
  RO: "Room only",
  BB: "Bed & breakfast",
  HB: "Half board",
  FB: "Full board",
  AI: "All-inclusive",
}

/** Resolve a board code (AI/HB/BB/RO/FB) to a readable label. */
function formatBoard(value: string | null): string | null {
  if (!value) return null
  return BOARD_LABELS[value.toUpperCase()] ?? value
}

/** Resolve a transport code ("flight") to a readable label. */
function formatTransport(value: string | null, messages: CatalogPageMessages): string | null {
  if (!value) return null
  return value === "flight" ? messages.card.flightIncluded : value
}

/** Format a (possibly fractional) star rating as e.g. "4.5★". */
function formatStars(value: unknown): string | null {
  const n = asNumber(value)
  if (n == null || n <= 0) return null
  return `${Number.isInteger(n) ? n : n.toFixed(1)}★`
}

function makeCruiseCard(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogCardConfig {
  return {
    // The cruise index carries the picture as `thumbnailUrl` and the "from"
    // price as `lowestPriceCached` (major currency units, e.g. "5898.00").
    imageField: "thumbnailUrl",
    priceAmountField: "lowestPriceCached",
    priceCurrencyField: "lowestPriceCurrencyCached",
    priceUnit: "major",
    subtitle: locationSubtitle,
    meta: (fields) => nightsMeta(fields, messages),
    // Next departure + how many sailings — sourced from the per-cruise sailing
    // rollup (`earliestDepartureCached` / `departureCount`).
    footerNote: (fields) =>
      departureNote(fields, messages, {
        dateField: "earliestDepartureCached",
        countField: "departureCount",
        withYear: true,
      }),
    chips: (fields) =>
      [...asStringArray(fields.themes), ...asStringArray(fields.regions)].slice(0, 3),
    badges: (fields) => supplierBadge(fields, "lineSupplierId", formatSupplier),
  }
}

function makeCharterCard(formatSupplier: (id: string | number) => string): CatalogCardConfig {
  return {
    imageField: "heroImageUrl",
    priceAmountField: "lowestPriceCachedAmount",
    priceCurrencyField: "lowestPriceCachedCurrency",
    subtitle: locationSubtitle,
    chips: (fields) =>
      [...asStringArray(fields.themes), ...asStringArray(fields.regions)].slice(0, 3),
    badges: (fields) => supplierBadge(fields, "lineSupplierId", formatSupplier),
  }
}

function makeAccommodationCard(formatSupplier: (id: string | number) => string): CatalogCardConfig {
  return {
    imageField: "thumbnailUrl",
    subtitle: (fields) => asString(fields.roomClass),
    badges: (fields) => supplierBadge(fields, "supplierId", formatSupplier),
  }
}

function locationSubtitle(fields: Record<string, unknown>): string | null {
  const cities = asStringArray(fields.cities)
  const regions = asStringArray(fields.regions)
  const countries = asStringArray(fields.countries)
  // Owned products carry resolved destination labels (cities/regions/countries);
  // sourced rows carry raw `destinations` + ISO `countryCodes` from the upstream
  // search document, so fall back to those and resolve the code to a name.
  const place = cities[0] ?? regions[0] ?? asStringArray(fields.destinations)[0] ?? null
  const country = countries[0] ?? asStringArray(fields.countryCodes).map(formatCountry)[0] ?? null
  const parts = [...new Set([place, country].filter((v): v is string => Boolean(v)))]
  return parts.length > 0 ? parts.join(" · ") : null
}

/** Resolve an ISO 3166 alpha-2 country code to a localized name (e.g. TR → Turkey). */
function formatCountry(value: string | number): string {
  const code = String(value)
  if (!/^[A-Za-z]{2}$/.test(code)) return code
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

function durationMeta(
  fields: Record<string, unknown>,
  messages: CatalogPageMessages,
): string | null {
  const days = asNumber(fields.durationDays)
  if (days == null || days < 1) return null
  const nights = Math.max(0, days - 1)
  return messages.card.daysNights
    .replace("{days}", String(days))
    .replace("{nights}", String(nights))
}

function nightsMeta(fields: Record<string, unknown>, messages: CatalogPageMessages): string | null {
  const nights = asNumber(fields.nights)
  if (nights == null || nights < 1) return null
  return messages.card.nights.replace("{nights}", String(nights))
}

function departureNote(
  fields: Record<string, unknown>,
  messages: CatalogPageMessages,
  opts: { dateField?: string; countField?: string; withYear?: boolean } = {},
): string | null {
  const next = asString(fields[opts.dateField ?? "nextDepartureDate"])
  const count = asNumber(fields[opts.countField ?? "availableDeparturesCount"])
  const parts: string[] = []
  if (next)
    parts.push(messages.card.nextDeparture.replace("{date}", formatShortDate(next, opts.withYear)))
  if (count != null && count > 0) {
    parts.push(
      count === 1
        ? messages.card.oneDeparture
        : messages.card.departures.replace("{count}", String(count)),
    )
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

function supplierBadge(
  fields: Record<string, unknown>,
  supplierField: string,
  formatSupplier: (id: string | number) => string,
): { label: string; variant?: "default" | "secondary" | "outline" }[] {
  const id = asString(fields[supplierField])
  if (!id) return []
  // The supplier (e.g. "TUI") is the merchandising signal operators care
  // about — more than the sourcing channel (Voyant Connect), which stays a
  // filter facet + a detail-sheet attribute.
  return [{ label: formatSupplier(id), variant: "secondary" }]
}

function formatShortDate(iso: string, withYear = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date)
}

/**
 * Render a `YYYY-MM` departure-month facet value as a localized "Mon YYYY"
 * label (e.g. `2027-03` → "Mar 2027"). Falls back to the raw value when it
 * isn't a parseable month key.
 */
function formatDepartureMonth(value: unknown): string {
  const raw = String(value)
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return raw
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(date)
}
