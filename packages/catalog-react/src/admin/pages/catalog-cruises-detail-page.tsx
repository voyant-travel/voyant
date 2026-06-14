"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { CruiseDetailHost } from "../cruise-detail-host.js"

/** Packaged route page for the source-driven cruise detail surface (`$id` param). */
export default function CatalogCruisesDetailPage({ params }: AdminRoutePageProps) {
  return <CruiseDetailHost id={params.id ?? ""} />
}
