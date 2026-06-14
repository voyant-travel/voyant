"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the accommodation detail surface (`$id` param). */
export default function CatalogAccommodationsDetailPage({ params }: AdminRoutePageProps) {
  return <VerticalDetailHost surface="accommodations" id={params.id ?? ""} />
}
