"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import { Image as ImageIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type {
  CatalogDetailEnrichment,
  CatalogDetailRenderSlot,
  CatalogDetailSheetProps,
} from "./catalog-detail-sheet.js"
import {
  type CatalogFilterField,
  CatalogSearchPage,
  type CatalogSearchTab,
} from "./catalog-search-page.js"

export interface CatalogPageSearchState {
  tab?: string
  q?: string
  page?: number
  market?: string
  locale?: string
}

export interface CatalogPageProps {
  search?: CatalogPageSearchState
  onTabChange?: (tabId: string) => void
  onQueryChange?: (query: string) => void
  onPageChange?: (page: number) => void
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
  onLoadProductDetail?: (hit: CatalogSearchHit) => Promise<CatalogDetailEnrichment | null>
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
  title?: ReactNode
  className?: string
}

export function CatalogPage({
  search = {},
  onTabChange,
  onQueryChange,
  onPageChange,
  toolbarEnd,
  formatSupplier = (id) => String(id),
  onBookHit,
  onBookDeparture,
  onBookOption,
  onOpenProductEditor,
  onLoadProductDetail,
  detailSheetWidth,
  detailHeaderExtras,
  renderDetailBrochure,
  renderDetailMedia,
  renderDetailItineraryDay,
  renderDetailExtraSections,
  renderSupplierLink,
  onTagsChange,
  title,
  className,
}: CatalogPageProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage
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
      onLoadDetail: onLoadProductDetail,
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
    },
    {
      id: "cruises",
      label: messages.tabs.cruises,
      vertical: "cruises",
      columns: makeCruiseColumns(formatSupplier, messages),
      filterFields: makeCruiseFilters(formatSupplier, messages),
      imageField: "heroImageUrl",
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
    {
      id: "charters",
      label: messages.tabs.charters,
      vertical: "charters",
      columns: makeCharterColumns(formatSupplier, messages),
      filterFields: makeCharterFilters(formatSupplier, messages),
      imageField: "heroImageUrl",
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
    {
      id: "accommodations",
      label: messages.tabs.accommodations,
      vertical: "accommodations",
      columns: makeAccommodationColumns(formatSupplier, messages),
      filterFields: makeAccommodationFilters(formatSupplier, messages),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
  ]

  return (
    <div className={cn("mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8", className)}>
      <CatalogSearchPage
        tabs={tabs}
        activeTab={search.tab ?? tabs[0]?.id}
        onActiveTabChange={(id) => onTabChange?.(id)}
        query={search.q ?? ""}
        onQueryChange={(q) => onQueryChange?.(q)}
        page={search.page ?? 1}
        onPageChange={(p) => onPageChange?.(p)}
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
    bookingModeColumn(messages),
    daysColumn(messages),
    nightsColumn(messages),
    availableDeparturesColumn(messages),
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
    nameColumn(messages.fallbacks.cruiseName, messages, "heroImageUrl"),
    statusColumn(messages),
    sourceColumn(messages),
    textColumn("cruiseType", messages.columns.type, messages),
    lookupColumn("lineSupplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("nights", messages.columns.nights, messages),
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

function bookingModeColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "bookingMode",
    header: messages.columns.bookingMode,
    cell: ({ row }) => {
      const mode = stringField(row.original, "bookingMode", null)
      if (!mode) return <span className="text-muted-foreground">{messages.values.empty}</span>
      return (
        <Badge variant="outline" className="capitalize">
          {mode}
        </Badge>
      )
    },
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

function availableDeparturesColumn(
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "availableDeparturesCount",
    header: messages.columns.availableDepartures,
    cell: ({ row }) => {
      const count = numberField(row.original, "availableDeparturesCount")
      if (count == null)
        return <span className="text-muted-foreground">{messages.values.empty}</span>
      return <span className="tabular-nums">{count}</span>
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
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: amountField,
    header,
    cell: ({ row }) => {
      const formatted = formatHitPrice(row.original, amountField, currencyField)
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

function stringField<T>(hit: CatalogSearchHit, key: string, fallback: T): string | T {
  const v = hit.document.fields[key]
  return typeof v === "string" && v.length > 0 ? v : fallback
}

function numberField(hit: CatalogSearchHit, key: string): number | null {
  const v = hit.document.fields[key]
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function formatHitPrice(
  hit: CatalogSearchHit,
  amountField: string,
  currencyField: string,
): string | null {
  const cents = numberField(hit, amountField)
  const currency = stringField(hit, currencyField, null)
  if (cents == null || !currency) return null
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
