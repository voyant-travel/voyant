"use client"

import { CruiseDetailHost } from "../cruise-detail-host.js"
import type { CatalogAdminRoutePageProps } from "../index.js"

/** Packaged route page for the source-driven cruise detail surface (`$id` param). */
export default function CatalogCruisesDetailPage({
  params,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  return <CruiseDetailHost id={params.id ?? ""} locale={scopeOptions?.defaultLocale} />
}
