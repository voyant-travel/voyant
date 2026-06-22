"use client"

import type { CatalogAdminRoutePageProps } from "../index.js"
import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the accommodation detail surface (`$id` param). */
export default function CatalogAccommodationsDetailPage({
  params,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  return (
    <VerticalDetailHost
      surface="accommodations"
      id={params.id ?? ""}
      locale={scopeOptions?.defaultLocale}
    />
  )
}
