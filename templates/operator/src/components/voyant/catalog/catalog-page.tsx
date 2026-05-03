"use client"

import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import {
  type CatalogFilterField,
  CatalogSearchPage,
  type CatalogSearchTab,
} from "@voyantjs/catalog-ui"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { cn } from "@voyantjs/ui/lib/utils"
import { useMemo } from "react"

import { type CatalogSearchParams, Route } from "@/routes/_workspace/catalog"

export function CatalogPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const suppliersQuery = useSuppliers({ limit: 200 })
  const supplierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliersQuery.data?.data ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersQuery.data])
  const formatSupplier = (id: string | number) => supplierMap.get(String(id)) ?? String(id)

  const supplierFormatter = (value: unknown) =>
    typeof value === "string" ? formatSupplier(value) : String(value ?? "")

  const sourceKindFormatter = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? formatSourceKind(value)
      : String(value ?? "")

  const tabs: CatalogSearchTab[] = [
    {
      id: "products",
      label: "Products",
      vertical: "products",
      columns: makeProductColumns(formatSupplier),
      filterFields: makeProductFilters(formatSupplier),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
      detailActions: [
        {
          label: "Open editor",
          onClick: (hit) => navigate({ to: "/products/$id", params: { id: hit.id } }),
        },
      ],
    },
    {
      id: "extras",
      label: "Extras",
      vertical: "extras",
      columns: makeExtraColumns(formatSupplier),
      filterFields: makeExtraFilters(formatSupplier),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
    {
      id: "cruises",
      label: "Cruises",
      vertical: "cruises",
      columns: makeCruiseColumns(formatSupplier),
      filterFields: makeCruiseFilters(formatSupplier),
      imageField: "heroImageUrl",
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
    {
      id: "charters",
      label: "Charters",
      vertical: "charters",
      columns: makeCharterColumns(formatSupplier),
      filterFields: makeCharterFilters(formatSupplier),
      imageField: "heroImageUrl",
      detailFormatters: {
        lineSupplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
    {
      id: "hospitality",
      label: "Hospitality",
      vertical: "hospitality",
      columns: makeHospitalityColumns(formatSupplier),
      filterFields: makeHospitalityFilters(formatSupplier),
      detailFormatters: {
        supplierId: supplierFormatter,
        "source.kind": sourceKindFormatter,
      },
    },
  ]

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <CatalogSearchPage
        tabs={tabs}
        activeTab={search.tab ?? tabs[0]?.id}
        onActiveTabChange={(id) =>
          routeNavigate({
            search: (prev): CatalogSearchParams => ({ ...prev, tab: id, page: 1 }),
            replace: false,
          })
        }
        query={search.q ?? ""}
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
        page={search.page ?? 1}
        onPageChange={(p) =>
          routeNavigate({
            search: (prev): CatalogSearchParams => ({ ...prev, page: p }),
            replace: true,
          })
        }
        title={
          <div>
            <h1 className="font-semibold text-2xl">Catalog</h1>
            <p className="text-muted-foreground text-sm">
              Search across every catalog vertical from one place.
            </p>
          </div>
        }
        searchPlaceholder="Search the catalog…"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-vertical column definitions
// ─────────────────────────────────────────────────────────────────────────────

function makeProductColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn(),
    nameColumn("Untitled product"),
    statusColumn(),
    sourceColumn(),
    lookupColumn("supplierId", "Supplier", formatSupplier),
    textColumn("bookingMode", "Booking mode"),
    textColumn("pax", "Pax"),
    priceColumn("sellAmountCents", "sellCurrency"),
  ]
}

function makeExtraColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn(),
    nameColumn("Untitled extra"),
    activeColumn(),
    sourceColumn(),
    lookupColumn("supplierId", "Supplier", formatSupplier),
    textColumn("selectionType", "Selection"),
    textColumn("pricingMode", "Pricing"),
    textColumn("defaultQuantity", "Default qty"),
  ]
}

function makeCruiseColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn("heroImageUrl"),
    nameColumn("Untitled cruise"),
    statusColumn(),
    sourceColumn(),
    textColumn("cruiseType", "Type"),
    lookupColumn("lineSupplierId", "Supplier", formatSupplier),
    textColumn("nights", "Nights"),
  ]
}

function makeCharterColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn("heroImageUrl"),
    nameColumn("Untitled charter"),
    statusColumn(),
    sourceColumn(),
    lookupColumn("lineSupplierId", "Supplier", formatSupplier),
    textColumn("defaultYachtId", "Yacht"),
    priceColumn("lowestPriceCachedAmount", "lowestPriceCachedCurrency", "From"),
  ]
}

function makeHospitalityColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn(),
    nameColumn("Untitled room"),
    activeColumn(),
    sourceColumn(),
    lookupColumn("supplierId", "Supplier", formatSupplier),
    textColumn("roomClass", "Class"),
    textColumn("maxOccupancy", "Max pax"),
    textColumn("bedroomCount", "Bedrooms"),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-vertical filter sets
// ─────────────────────────────────────────────────────────────────────────────

function makeProductFilters(formatSupplier: (id: string | number) => string): CatalogFilterField[] {
  return [
    { field: "status", label: "Status" },
    { field: "source.kind", label: "Source", formatValue: formatSourceKind },
    { field: "supplierId", label: "Supplier", formatValue: formatSupplier },
    { field: "bookingMode", label: "Booking mode" },
    { field: "productTypeId", label: "Type" },
    { field: "capacityMode", label: "Capacity" },
    { field: "visibility", label: "Visibility" },
    { field: "facilityId", label: "Facility" },
    {
      kind: "range",
      field: "sellAmountCents",
      label: "Price",
      format: "currency",
      currency: "EUR",
      step: 100,
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
    {
      kind: "range",
      field: "pax",
      label: "Pax",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
  ]
}

function makeExtraFilters(formatSupplier: (id: string | number) => string): CatalogFilterField[] {
  return [
    { field: "active", label: "Active" },
    { field: "source.kind", label: "Source", formatValue: formatSourceKind },
    { field: "supplierId", label: "Supplier", formatValue: formatSupplier },
    { field: "selectionType", label: "Selection" },
    { field: "pricingMode", label: "Pricing mode" },
    { field: "pricedPerPerson", label: "Per person" },
    {
      kind: "range",
      field: "minQuantity",
      label: "Min qty",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
    {
      kind: "range",
      field: "maxQuantity",
      label: "Max qty",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
  ]
}

function makeCruiseFilters(formatSupplier: (id: string | number) => string): CatalogFilterField[] {
  return [
    { field: "status", label: "Status" },
    { field: "source.kind", label: "Source", formatValue: formatSourceKind },
    { field: "cruiseType", label: "Type" },
    { field: "lineSupplierId", label: "Supplier", formatValue: formatSupplier },
    { field: "defaultShipId", label: "Ship" },
    { field: "embarkPortFacilityId", label: "Embark" },
    { field: "disembarkPortFacilityId", label: "Disembark" },
    { field: "regions", label: "Region" },
    { field: "themes", label: "Theme" },
    {
      kind: "range",
      field: "nights",
      label: "Nights",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
  ]
}

function makeCharterFilters(formatSupplier: (id: string | number) => string): CatalogFilterField[] {
  return [
    { field: "status", label: "Status" },
    { field: "source.kind", label: "Source", formatValue: formatSourceKind },
    { field: "lineSupplierId", label: "Supplier", formatValue: formatSupplier },
    { field: "defaultYachtId", label: "Yacht" },
    { field: "defaultBookingModes", label: "Booking mode" },
    { field: "regions", label: "Region" },
    { field: "themes", label: "Theme" },
    {
      kind: "range",
      field: "lowestPriceCachedAmount",
      label: "Price",
      format: "currency",
      currency: "EUR",
      step: 100,
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
    {
      kind: "range",
      field: "defaultApaPercent",
      label: "APA %",
      step: 1,
      minPlaceholder: "0",
      maxPlaceholder: "100",
    },
  ]
}

function makeHospitalityFilters(
  formatSupplier: (id: string | number) => string,
): CatalogFilterField[] {
  return [
    { field: "active", label: "Active" },
    { field: "source.kind", label: "Source", formatValue: formatSourceKind },
    { field: "supplierId", label: "Supplier", formatValue: formatSupplier },
    { field: "inventoryMode", label: "Inventory" },
    { field: "roomClass", label: "Class" },
    { field: "smokingAllowed", label: "Smoking" },
    { field: "propertyId", label: "Property" },
    {
      kind: "range",
      field: "maxOccupancy",
      label: "Max pax",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
    {
      kind: "range",
      field: "bedroomCount",
      label: "Bedrooms",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
    {
      kind: "range",
      field: "bathroomCount",
      label: "Bathrooms",
      minPlaceholder: "0",
      maxPlaceholder: "Any",
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Column factories — kept generic so each vertical's column array is just a
// list of one-line calls.
// ─────────────────────────────────────────────────────────────────────────────

function thumbnailColumn(urlField = "thumbnailUrl"): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "thumbnail",
    header: "",
    cell: ({ row }) => <CatalogThumbnail hit={row.original} urlField={urlField} />,
  }
}

function nameColumn(fallback: string): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{stringField(row.original, "name", fallback)}</span>
    ),
  }
}

function statusColumn(): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "status",
    header: "Status",
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

function activeColumn(): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "active",
    header: "Active",
    cell: ({ row }) => {
      const v = stringField(row.original, "active", null)
      if (v == null) return null
      const isActive = v === "true" || v === "1"
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      )
    },
  }
}

function textColumn(field: string, header: string): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: field,
    header,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{stringField(row.original, field, "—")}</span>
    ),
  }
}

/**
 * Source column — renders provenance (`source.kind`) as a small badge so it's
 * scannable across rows. Owned inventory shows in muted/secondary; sourced
 * (Voyant Connect, GDS, direct, bedbank, manual) shows in outline so adapter
 * origins stand out at a glance.
 */
function sourceColumn(): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: "source.kind",
    header: "Source",
    cell: ({ row }) => {
      const kind = stringField(row.original, "source.kind", null)
      if (!kind) return <span className="text-muted-foreground">—</span>
      return (
        <Badge variant={kind === "owned" ? "secondary" : "outline"}>{formatSourceKind(kind)}</Badge>
      )
    },
  }
}

/**
 * Maps a `source.kind` value to a human-readable label. Falls back to the
 * raw value (title-cased) for unknown kinds so new adapters surface
 * automatically without a UI change.
 */
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
  // direct:tui → "TUI (direct)", direct:viking → "Viking (direct)"
  if (raw.startsWith("direct:")) {
    const brand = raw.slice("direct:".length)
    return `${brand.toUpperCase()} (direct)`
  }
  // Fallback: capitalize first letter of each segment.
  return raw
    .split(/[:\-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}

/**
 * Cell that resolves an indexed ID against a runtime lookup map (e.g.
 * supplier id → supplier name). Falls back to the raw id when the lookup
 * misses, so a not-yet-loaded supplier list degrades to the same display
 * we had before.
 */
function lookupColumn(
  field: string,
  header: string,
  format: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: field,
    header,
    cell: ({ row }) => {
      const id = stringField(row.original, field, null)
      if (!id) return <span className="text-muted-foreground">—</span>
      return <span>{format(id)}</span>
    },
  }
}

function priceColumn(
  amountField: string,
  currencyField: string,
  header = "Price",
): ColumnDef<CatalogSearchHit, unknown> {
  return {
    id: amountField,
    header,
    cell: ({ row }) => {
      const formatted = formatPrice(row.original, amountField, currencyField)
      return (
        <span className="font-medium">
          {formatted ?? <span className="text-muted-foreground">—</span>}
        </span>
      )
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail cell + helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Square avatar-style cell. Uses an indexed `thumbnailUrl` (or vertical-
 * specific `urlField` like `heroImageUrl`) if present; otherwise renders
 * initials over a deterministic gradient seeded by the entity id.
 */
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

  const gradient = thumbnailGradient(hit.id)
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-medium text-white",
        gradient,
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
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
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

function formatPrice(
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
