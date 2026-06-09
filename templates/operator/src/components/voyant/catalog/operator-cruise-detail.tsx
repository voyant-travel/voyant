"use client"

import { useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { CruiseDetailPage } from "@voyantjs/catalog-ui"
import { useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Operator host for the packaged `CruiseDetailPage` — injects the localized
 * "Cruises" label, router navigation to the booking journey, and breadcrumbs.
 */
export function OperatorCruiseDetail({ id, locale }: { id: string; locale?: string }) {
  const navigate = useNavigate()
  const cruisesLabel = useAdminMessages().nav.catalogCruises
  const [crumbs, setCrumbs] = useState<Array<{ label: string; href?: string }>>([
    { label: cruisesLabel, href: "/catalog/cruises" },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <CruiseDetailPage
      id={id}
      locale={locale}
      cruisesLabel={cruisesLabel}
      cruisesHref="/catalog/cruises"
      onBreadcrumbs={setCrumbs}
      // Cruises carry a sailing + cabin selection, so they name their vertical
      // via `?module`; provenance still resolves server-side from (module, id).
      // The sailing's date locks the departure step; name/hero preview the panel.
      onBook={(cruiseId, opts) =>
        void navigate({
          to: "/bookings/new/$entityId",
          params: { entityId: cruiseId },
          search: {
            module: "cruises",
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
