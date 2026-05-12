"use client"

import type { UpdateOrganizationInput } from "@voyantjs/crm-react"
import {
  useActivities,
  useOpportunities,
  useOrganization,
  useOrganizationMutation,
  usePeople,
} from "@voyantjs/crm-react"
import { Button, cn } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import {
  type OrganizationDetailPageSlots,
  type OrganizationDetailTab,
  OrganizationMain,
  OrganizationSidebar,
  OrganizationTopBar,
} from "./organization-detail-sections.js"

export interface OrganizationDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onPersonOpen?: (personId: string) => void
  slots?: OrganizationDetailPageSlots
}

export function OrganizationDetailPage({
  id,
  className,
  onBack,
  onDeleted,
  onPersonOpen,
  slots,
}: OrganizationDetailPageProps) {
  const messages = useCrmUiMessagesOrDefault()
  const [activeTab, setActiveTab] = useState<OrganizationDetailTab>("overview")
  const orgQuery = useOrganization(id)
  const { remove, update } = useOrganizationMutation()

  const updateField = async (patch: UpdateOrganizationInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const org = orgQuery.data
  const peopleQuery = usePeople({ organizationId: id, limit: 50, enabled: Boolean(org) })
  const opportunitiesQuery = useOpportunities({
    organizationId: id,
    limit: 50,
    enabled: Boolean(org),
  })
  const activitiesQuery = useActivities({
    entityType: "organization",
    entityId: id,
    limit: 50,
    enabled: Boolean(org),
  })

  if (orgQuery.isPending) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
        <p className="text-muted-foreground">{messages.organizationDetailPage.notFound}</p>
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            {messages.organizationDetailPage.backToOrganizations}
          </Button>
        ) : null}
      </div>
    )
  }

  const people = peopleQuery.data?.data ?? []
  const opportunities = opportunitiesQuery.data?.data ?? []
  const activities = activitiesQuery.data?.data ?? []
  const totalOpenValue = opportunities
    .filter((opportunity) => opportunity.status === "open")
    .reduce((sum, opportunity) => sum + (opportunity.valueAmountCents ?? 0), 0)
  const primaryCurrency = opportunities[0]?.valueCurrency ?? org.defaultCurrency ?? null
  const websiteHref = org.website
    ? org.website.startsWith("http")
      ? org.website
      : `https://${org.website}`
    : undefined

  return (
    <div
      data-slot="organization-detail-page"
      className={cn("flex min-h-screen flex-col", className)}
    >
      <OrganizationTopBar
        orgName={org.name}
        onBack={() => onBack?.()}
        deletePending={remove.isPending}
        onDelete={async () => {
          await remove.mutateAsync(id)
          onDeleted?.()
          onBack?.()
        }}
      />
      {slots?.afterTopBar}

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <OrganizationSidebar org={org} websiteHref={websiteHref} onUpdateField={updateField}>
          {slots?.sidebarEnd}
        </OrganizationSidebar>
        <OrganizationMain
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          org={org}
          people={people}
          opportunities={opportunities}
          activities={activities}
          peoplePending={peopleQuery.isPending}
          opportunitiesPending={opportunitiesQuery.isPending}
          activitiesPending={activitiesQuery.isPending}
          totalOpenValue={totalOpenValue}
          primaryCurrency={primaryCurrency}
          onOpenPerson={(personId) => onPersonOpen?.(personId)}
          onUpdateField={updateField}
          slots={slots}
        />
      </div>
    </div>
  )
}
