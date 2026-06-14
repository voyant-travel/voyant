"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the excursion detail surface (`$id` param). */
export default function CatalogExcursionsDetailPage({ params }: AdminRoutePageProps) {
  return <VerticalDetailHost surface="excursions" id={params.id ?? ""} />
}
