"use client"

import type { CatalogAdminRoutePageProps } from "../index.js"
import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the excursion detail surface (`$id` param). */
export default function CatalogExcursionsDetailPage({
  params,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  return (
    <VerticalDetailHost
      surface="excursions"
      id={params.id ?? ""}
      locale={scopeOptions?.defaultLocale}
    />
  )
}
