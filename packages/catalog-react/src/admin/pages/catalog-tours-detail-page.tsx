"use client"

import type { CatalogAdminRoutePageProps } from "../index.js"
import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the tour detail surface (`$id` param). */
export default function CatalogToursDetailPage({
  params,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  return (
    <VerticalDetailHost surface="tours" id={params.id ?? ""} locale={scopeOptions?.defaultLocale} />
  )
}
