"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import type { ReactNode } from "react"

import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogDetailEnrichment } from "./catalog-detail-sheet.js"
import {
  type CatalogFilterField,
  CatalogSearchPage,
  type CatalogSearchTab,
} from "./catalog-search-page.js"

export interface CatalogPageSearchState {
  tab?: string
  q?: string
  page?: number
}

export interface CatalogPageProps {
  search?: CatalogPageSearchState
  onTabChange?: (tabId: string) => void
  onQueryChange?: (query: string) => void
  onPageChange?: (page: number) => void
  formatSupplier?: (id: string | number) => string
  onBookHit?: (hit: CatalogSearchHit, entityModule: string) => void
  onBookDeparture?: (
    hit: CatalogSearchHit,
    entityModule: string,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
  ) => void
  onOpenProductEditor?: (hit: CatalogSearchHit) => void
  onLoadProductDetail?: (hit: CatalogSearchHit) => Promise<CatalogDetailEnrichment | null>
  title?: ReactNode
  className?: string
}

export function CatalogPage({
  search = {},
  onTabChange,
  onQueryChange,
  onPageChange,
  formatSupplier = (id) => String(id),
  onBookHit,
  onBookDeparture,
  onOpenProductEditor,
  onLoadProductDetail,
  title,
  className,
}: CatalogPageProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage
  const supplierFormatter = (value: unknown) =>
    typeof value === "string" ? formatSupplier(value) : String(value ?? "")
  const sourceKindFormatter = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? formatSourceKind(value)
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
              },
            ]
          : []),
      ],
      onLoadDetail: onLoadProductDetail,
      onBookDeparture: onBookDeparture
        ? (hit, departure) => onBookDeparture(hit, "products", departure)
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
      id: "hospitality",
      label: messages.tabs.hospitality,
      vertical: "hospitality",
      columns: makeHospitalityColumns(formatSupplier, messages),
      filterFields: makeHospitalityFilters(formatSupplier, messages),
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
    thumbnailColumn(),
    nameColumn(messages.fallbacks.productName, messages),
    statusColumn(messages),
    sourceColumn(messages),
    lookupColumn("supplierId", messages.columns.supplier, formatSupplier, messages),
    textColumn("bookingMode", messages.columns.bookingMode, messages),
    textColumn("pax", messages.columns.pax, messages),
    priceColumn("sellAmountCents", "sellCurrency", messages.columns.price, messages),
  ]
}

function makeExtraColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn(),
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
    thumbnailColumn("heroImageUrl"),
    nameColumn(messages.fallbacks.cruiseName, messages),
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
    thumbnailColumn("heroImageUrl"),
    nameColumn(messages.fallbacks.charterName, messages),
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

function makeHospitalityColumns(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn(),
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
    { field: "source.kind", label: messages.filters.source, formatValue: formatSourceKind },
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
    { field: "source.kind", label: messages.filters.source, formatValue: formatSourceKind },
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
    { field: "source.kind", label: messages.filters.source, formatValue: formatSourceKind },
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
    { field: "source.kind", label: messages.filters.source, formatValue: formatSourceKind },
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

function makeHospitalityFilters(
  formatSupplier: (id: string | number) => string,
  messages: CatalogPageMessages,
): CatalogFilterField[] {
  return [
    { field: "active", label: messages.filters.active },
    { field: "source.kind", label: messages.filters.source, formatValue: formatSourceKind },
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

function thumbnailColumn(urlField = "thumbnailUrl"): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "thumbnail",
    header: "",
    cell: ({ row }) => <CatalogThumbnail hit={row.original} urlField={urlField} />,
  }
}

function nameColumn(
  fallback: string,
  messages: CatalogPageMessages,
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "name",
    header: messages.columns.name,
    cell: ({ row }) => (
      <span className="font-medium">{stringField(row.original, "name", fallback)}</span>
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

function sourceColumn(messages: CatalogPageMessages): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "source.kind",
    header: messages.columns.source,
    cell: ({ row }) => {
      const kind = stringField(row.original, "source.kind", null)
      if (!kind) return <span className="text-muted-foreground">{messages.values.empty}</span>
      return (
        <Badge variant={kind === "owned" ? "secondary" : "outline"}>{formatSourceKind(kind)}</Badge>
      )
    },
  }
}

function formatSourceKind(value: string | number): string {
  const raw = String(value)
  const known: Record<string, string> = {
    owned: "Owned",
    "voyant-connect": "Voyant Connect",
    manual: "Manual",
    "gds:amadeus": "Amadeus",
    "gds:sabre": "Sabre",
    "gds:travelport": "Travelport",
    "bedbank:hotelbeds": "Hotelbeds",
    "bedbank:expedia": "Expedia",
  }
  if (known[raw]) return known[raw]
  if (raw.startsWith("direct:")) return `${raw.slice("direct:".length).toUpperCase()} (direct)`
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
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"

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
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-medium text-white",
        thumbnailGradient(hit.id),
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

const GRADIENTS = [
  "bg-gradient-to-br from-rose-500 to-orange-500",
  "bg-gradient-to-br from-amber-500 to-yellow-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-sky-500 to-indigo-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-fuchsia-500 to-pink-600",
] as const

function thumbnailGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length] as string
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
