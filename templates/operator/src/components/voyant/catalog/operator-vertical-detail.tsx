"use client"

import { useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import {
  type CatalogDetailSurface,
  type CatalogVerticalDetailBreadcrumb,
  CatalogVerticalDetailPage,
  catalogSurfaceVertical,
} from "@voyantjs/catalog-ui"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { useMemo, useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Operator host for the packaged `CatalogVerticalDetailPage` — injects the
 * operator-only concerns (supplier directory, nav labels, router navigation +
 * breadcrumbs) so the route files stay trivial.
 */
export function OperatorVerticalDetail({
  surface,
  id,
}: {
  surface: CatalogDetailSurface
  id: string
}) {
  const navigate = useNavigate()
  const nav = useAdminMessages().nav
  const vertical = catalogSurfaceVertical(surface)
  const surfaceLabel = surfaceTitle(surface, nav)

  const suppliersQuery = useSuppliers({ limit: 100 })
  const formatSupplier = useMemo(() => {
    const m = new Map<string, string>()
    for (const sup of suppliersQuery.data?.data ?? []) m.set(sup.id, sup.name)
    return (sid: string) => m.get(String(sid)) ?? String(sid)
  }, [suppliersQuery.data])

  // The packaged page resolves the title from content; mirror its breadcrumbs
  // into the admin breadcrumb bar.
  const [crumbs, setCrumbs] = useState<CatalogVerticalDetailBreadcrumb[]>([
    { label: surfaceLabel, href: `/catalog/${surface}` },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <CatalogVerticalDetailPage
      id={id}
      vertical={vertical}
      surfaceLabel={surfaceLabel}
      surfaceHref={`/catalog/${surface}`}
      formatSupplier={formatSupplier}
      onBreadcrumbs={setCrumbs}
      // Non-product verticals name themselves via `?module` (products is the
      // default); provenance resolves server-side from (module, id). The picked
      // departure's date locks the departure step; name/hero preview the panel.
      onBook={(entityModule, entityId, opts) =>
        void navigate({
          to: "/bookings/new/$entityId",
          params: { entityId },
          search: {
            ...(entityModule !== "products" ? { module: entityModule } : {}),
            ...(opts.departureId ? { departureId: opts.departureId } : {}),
            ...(opts.departureDate ? { departureDate: opts.departureDate.slice(0, 10) } : {}),
            ...(opts.optionId ? { optionId: opts.optionId } : {}),
          },
          state: {
            ...(opts.name ? { entityName: opts.name } : {}),
            ...(opts.heroImageUrl ? { entityImageUrl: opts.heroImageUrl } : {}),
          },
        })
      }
    />
  )
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
