"use client"

import { useNavigate } from "@tanstack/react-router"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { type CatalogDetailEnrichment, CatalogPage as CatalogUiPage } from "@voyantjs/catalog-ui"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { useMemo } from "react"
import { toast } from "sonner"

import type { ProductSourcedContentResponse } from "@/components/voyant/products/product-detail-shared"
import { ApiError, api } from "@/lib/api-client"
import { type CatalogSearchParams, Route } from "@/routes/_workspace/catalog"

export function CatalogPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const suppliersQuery = useSuppliers({ limit: 100 })
  const supplierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suppliersQuery.data?.data ?? []) m.set(s.id, s.name)
    return m
  }, [suppliersQuery.data])
  const formatSupplier = (id: string | number) => supplierMap.get(String(id)) ?? String(id)

  return (
    <CatalogUiPage
      search={search}
      formatSupplier={formatSupplier}
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
      onOpenProductEditor={(hit) => navigate({ to: "/products/$id", params: { id: hit.id } })}
      onLoadProductDetail={(hit) => loadProductDetail(hit, formatSupplier)}
    />
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
): void {
  const sourceKind = stringField(hit, "source.kind", null)
  if (!sourceKind || sourceKind === "owned") {
    toast.info("Booking via the catalog engine is only wired for sourced inventory today.", {
      description:
        sourceKind === "owned"
          ? "Owned products go through the existing product workflow - try a Demo source row."
          : "This row has no source.kind; book through the per-vertical workflow instead.",
    })
    return
  }

  const sourceRef = stringField(hit, "source.ref", null) ?? undefined
  const name = stringField(hit, "name", null) ?? undefined
  const supplierId = stringField(hit, "supplierId", null) ?? undefined
  navigate({
    to: "/catalog/book/$entityModule/$entityId",
    params: { entityModule, entityId: hit.id },
    search: {
      sourceKind,
      ...(sourceRef ? { sourceRef } : {}),
      ...(name ? { name } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(departure ? { departureId: departure.id, departureStartsAt: departure.startsAt } : {}),
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
