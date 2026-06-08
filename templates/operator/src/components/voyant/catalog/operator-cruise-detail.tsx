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
      onBook={(cruiseId, opts) =>
        void navigate({
          to: "/bookings/journey/$entityModule/$entityId",
          params: { entityModule: "cruises", entityId: cruiseId },
          search: {
            sourceKind: "voyant-connect",
            ...(opts.departureId ? { departureId: opts.departureId } : {}),
            ...(opts.optionId ? { optionId: opts.optionId } : {}),
          },
        })
      }
    />
  )
}
