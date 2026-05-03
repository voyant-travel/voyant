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
import { toast } from "sonner"

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

  const tabs: CatalogSearchTab[] = [
    {
      id: "products",
      label: "Products",
      vertical: "products",
      columns: productColumns,
      filterFields: productFilters,
      detailActions: [
        {
          label: "Book this",
          onClick: (hit) => {
            void quoteAndBook(hit, "products", navigate)
          },
        },
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
      columns: extraColumns,
      filterFields: extraFilters,
    },
    {
      id: "cruises",
      label: "Cruises",
      vertical: "cruises",
      columns: makeCruiseColumns(formatSupplier),
      filterFields: makeCruiseFilters(formatSupplier),
      imageField: "heroImageUrl",
      detailFormatters: { lineSupplierId: supplierFormatter },
    },
    {
      id: "charters",
      label: "Charters",
      vertical: "charters",
      columns: makeCharterColumns(formatSupplier),
      filterFields: makeCharterFilters(formatSupplier),
      imageField: "heroImageUrl",
      detailFormatters: { lineSupplierId: supplierFormatter },
    },
    {
      id: "hospitality",
      label: "Hospitality",
      vertical: "hospitality",
      columns: hospitalityColumns,
      filterFields: hospitalityFilters,
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

const productColumns: ColumnDef<CatalogSearchHit, unknown>[] = [
  thumbnailColumn(),
  nameColumn("Untitled product"),
  statusColumn(),
  textColumn("bookingMode", "Booking mode"),
  textColumn("pax", "Pax"),
  priceColumn("sellAmountCents", "sellCurrency"),
]

const extraColumns: ColumnDef<CatalogSearchHit, unknown>[] = [
  thumbnailColumn(),
  nameColumn("Untitled extra"),
  activeColumn(),
  textColumn("selectionType", "Selection"),
  textColumn("pricingMode", "Pricing"),
  textColumn("defaultQuantity", "Default qty"),
]

function makeCruiseColumns(
  formatSupplier: (id: string | number) => string,
): ColumnDef<CatalogSearchHit, unknown>[] {
  return [
    thumbnailColumn("heroImageUrl"),
    nameColumn("Untitled cruise"),
    statusColumn(),
    textColumn("cruiseType", "Type"),
    lookupColumn("lineSupplierId", "Line", formatSupplier),
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
    lookupColumn("lineSupplierId", "Line", formatSupplier),
    textColumn("defaultYachtId", "Yacht"),
    priceColumn("lowestPriceCachedAmount", "lowestPriceCachedCurrency", "From"),
  ]
}

const hospitalityColumns: ColumnDef<CatalogSearchHit, unknown>[] = [
  thumbnailColumn(),
  nameColumn("Untitled room"),
  activeColumn(),
  textColumn("roomClass", "Class"),
  textColumn("maxOccupancy", "Max pax"),
  textColumn("bedroomCount", "Bedrooms"),
]

// ─────────────────────────────────────────────────────────────────────────────
// Per-vertical filter sets
// ─────────────────────────────────────────────────────────────────────────────

const productFilters: CatalogFilterField[] = [
  { field: "status", label: "Status" },
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

const extraFilters: CatalogFilterField[] = [
  { field: "active", label: "Active" },
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

function makeCruiseFilters(formatSupplier: (id: string | number) => string): CatalogFilterField[] {
  return [
    { field: "status", label: "Status" },
    { field: "cruiseType", label: "Type" },
    { field: "lineSupplierId", label: "Line", formatValue: formatSupplier },
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
    { field: "lineSupplierId", label: "Line", formatValue: formatSupplier },
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

const hospitalityFilters: CatalogFilterField[] = [
  { field: "active", label: "Active" },
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

// ─────────────────────────────────────────────────────────────────────────────
// Booking-engine action: quote + book in one click.
//
// The catalog detail sheet's actions API doesn't support per-hit
// disabling, so this helper is the runtime check: rows without a
// `source.kind` or with `source.kind = "owned"` toast a friendly
// "not yet supported" message. Rows with a registered adapter (today
// just `"demo"`) flow through quote → book and the result is toasted
// with a link to the orders page.
// ─────────────────────────────────────────────────────────────────────────────

type AppNavigate = ReturnType<typeof useNavigate>

interface QuoteResponse {
  quoteId: string
  expiresAt: string
  available: boolean
  invalidReason?: string
  pricing?: { base_amount: number; currency: string }
}

interface BookResponse {
  bookingId: string
  orderRef: string
  status: "held" | "confirmed" | "ticketed" | "failed"
  snapshotId: string
}

interface ErrorResponse {
  error?: string
  code?: string
}

async function quoteAndBook(
  hit: CatalogSearchHit,
  entityModule: string,
  navigate: AppNavigate,
): Promise<void> {
  const sourceKind = stringField(hit, "source.kind", null)
  if (!sourceKind || sourceKind === "owned") {
    toast.info("Booking via the catalog engine is only wired for sourced inventory today.", {
      description:
        sourceKind === "owned"
          ? "Owned products go through the existing product workflow — try a Demo source row."
          : "This row has no source.kind; book through the per-vertical workflow instead.",
    })
    return
  }

  const sourceRef = stringField(hit, "source.ref", null) ?? undefined

  toast.loading("Quoting…", { id: "catalog-book" })
  try {
    const quote = await postJson<QuoteResponse | ErrorResponse>("/v1/admin/catalog/quote", {
      entityModule,
      entityId: hit.id,
      sourceKind,
      sourceRef,
      scope: { locale: "en-GB", audience: "staff", market: "default" },
    })
    if ("error" in quote && quote.error) {
      toast.error(`Quote failed: ${quote.error}`, { id: "catalog-book" })
      return
    }
    const q = quote as QuoteResponse
    if (!q.available) {
      toast.error(`Quote returned unavailable${q.invalidReason ? ` — ${q.invalidReason}` : ""}`, {
        id: "catalog-book",
      })
      return
    }

    toast.loading("Booking…", { id: "catalog-book" })
    const book = await postJson<BookResponse | ErrorResponse>("/v1/admin/catalog/book", {
      quoteId: q.quoteId,
    })
    if ("error" in book && book.error) {
      toast.error(`Book failed: ${book.error}`, { id: "catalog-book" })
      return
    }
    const b = book as BookResponse
    toast.success(`Booked — order ${b.orderRef.slice(0, 16)}… (${b.status})`, {
      id: "catalog-book",
      action: {
        label: "View orders",
        onClick: () => navigate({ to: "/orders/catalog" }),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    toast.error(`Book request failed: ${message}`, { id: "catalog-book" })
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  return (await res.json()) as T
}
