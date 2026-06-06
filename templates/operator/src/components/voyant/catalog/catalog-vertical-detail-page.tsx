"use client"

import { useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs, useLocale } from "@voyantjs/admin"
import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import {
  type CatalogDetailEnrichment,
  CatalogDetailView,
  type CatalogSlotAvailability,
  createCatalogEnrichmentFetchers,
} from "@voyantjs/catalog-ui"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { Image as ImageIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { type CatalogDetailSurface, catalogSurfaceVertical } from "./catalog-route-state"

/**
 * Generic, full-page, URL-addressable detail page for the non-package catalog
 * surfaces (cruises, accommodations, excursions, tours). Reads the rich content
 * **directly from the content route by id** (the same source the detail sheet
 * uses — keyed by the catalog id, so it works where a Typesense `id` filter
 * doesn't) and renders the shared `CatalogDetailView`. Opened in a new tab from
 * the surface's results. Packages keep their own bespoke detail page.
 */

const CONTENT_BASE_BY_VERTICAL: Record<string, string> = {
  products: "/v1/admin/products",
  cruises: "/v1/admin/cruises",
  accommodations: "/v1/admin/accommodations",
}

type Status = "loading" | "ready" | "notfound" | "error"

export function CatalogVerticalDetailPage({
  surface,
  id,
}: {
  surface: CatalogDetailSurface
  id: string
}) {
  const messages = useAdminMessages()
  const nav = messages.nav
  const navigate = useNavigate()
  const { resolvedLocale } = useLocale()
  const vertical = catalogSurfaceVertical(surface)
  const surfaceLabel = surfaceTitle(surface, nav)

  const suppliersQuery = useSuppliers({ limit: 100 })
  const supplierMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const sup of suppliersQuery.data?.data ?? []) m.set(sup.id, sup.name)
    return m
  }, [suppliersQuery.data])

  const fetchers = useMemo(
    () =>
      createCatalogEnrichmentFetchers({
        baseUrl: getApiUrl(),
        contentBasePathByVertical: CONTENT_BASE_BY_VERTICAL,
        credentials: "include",
        locale: resolvedLocale,
        formatSupplier: (sid) => supplierMap.get(String(sid)) ?? String(sid),
        loadSlotAvailability,
      }),
    [resolvedLocale, supplierMap],
  )

  // Minimal hit — the detail body keys off `hit.id` for content + the slots
  // call; the index projection isn't available by id, so fields stay empty and
  // the rich content comes from the enrichment.
  const hit = useMemo<CatalogSearchHit>(
    () => ({ id, score: 0, document: { id, fields: {} } }),
    [id],
  )

  const [enrichment, setEnrichment] = useState<CatalogDetailEnrichment | null>(null)
  const [status, setStatus] = useState<Status>("loading")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setEnrichment(null)
    void (async () => {
      try {
        const enr = await fetchers.loadProductDetail(hit, vertical)
        if (cancelled) return
        if (!enr) {
          setStatus("notfound")
          return
        }
        setEnrichment(enr)
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hit, vertical, fetchers])

  const name = enrichment?.name ?? null
  useAdminBreadcrumbs(
    name
      ? [{ label: surfaceLabel, href: `/catalog/${surface}` }, { label: name }]
      : [{ label: surfaceLabel, href: `/catalog/${surface}` }],
  )

  // Booking: route to the unified journey. entityModule = the content vertical.
  const book = (departureId?: string, optionId?: string) => {
    void navigate({
      to: "/catalog/journey/$entityModule/$entityId",
      params: { entityModule: vertical, entityId: id },
      search: {
        sourceKind: "voyant-connect",
        ...(departureId ? { departureId } : {}),
        ...(optionId ? { optionId } : {}),
      },
    })
  }

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
        <div className="h-7 w-1/3 animate-pulse rounded bg-muted/40" />
        <div className="mt-2 h-4 w-1/4 animate-pulse rounded bg-muted/20" />
        <div className="mt-6 h-72 w-full animate-pulse rounded-lg bg-muted/30" />
      </div>
    )
  }

  if (status === "notfound" || status === "error" || !enrichment) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground text-sm">
          {status === "notfound"
            ? messages.catalog.detail.notFound
            : messages.catalog.detail.loadError}
        </div>
      </div>
    )
  }

  const heroUrl = enrichment.heroImageUrl
  const subtitle = enrichment.supplier

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={name ?? ""}
            className="h-20 w-28 shrink-0 rounded-lg object-cover ring-1 ring-border"
            loading="lazy"
          />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-2xl">{name ?? surfaceLabel}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>

      {/* Shared tabbed detail body */}
      <div className="mt-6">
        <CatalogDetailView
          hit={hit}
          enrichment={enrichment}
          vertical={vertical}
          onLoadDeparturePricing={(h, sailingRef) =>
            fetchers.loadDeparturePricing(h, sailingRef, vertical)
          }
          onBookDeparture={(_h, departure) => book(departure.sourceRef ?? departure.id)}
          onBookOption={(_h, departure, option) =>
            book(departure.sourceRef ?? departure.id, option.id)
          }
        />
      </div>
    </div>
  )
}

async function loadSlotAvailability(
  productId: string,
): Promise<Map<string, CatalogSlotAvailability>> {
  try {
    const res = await fetch(
      `${getApiUrl()}/v1/admin/catalog/slots?entityModule=products&entityId=${encodeURIComponent(productId)}`,
      { credentials: "include" },
    )
    const json = (await res.json()) as {
      rows?: Array<CatalogSlotAvailability & { startsAt: string }>
    }
    return new Map((json.rows ?? []).map((slot) => [slot.id, slot]))
  } catch {
    return new Map()
  }
}

function surfaceTitle(
  surface: CatalogDetailSurface,
  nav: ReturnType<typeof useAdminMessages>["nav"],
): string {
  switch (surface) {
    case "cruises":
      return nav.catalogCruises
    case "accommodations":
      return nav.catalogAccommodations
    case "excursions":
      return nav.catalogExcursions
    case "tours":
      return nav.catalogTours
    default:
      return nav.catalogProducts
  }
}
