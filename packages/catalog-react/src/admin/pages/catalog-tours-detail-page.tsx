"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { VerticalDetailHost } from "../vertical-detail-host.js"

/** Packaged route page for the tour detail surface (`$id` param). */
export default function CatalogToursDetailPage({ params }: AdminRoutePageProps) {
  return <VerticalDetailHost surface="tours" id={params.id ?? ""} />
}
