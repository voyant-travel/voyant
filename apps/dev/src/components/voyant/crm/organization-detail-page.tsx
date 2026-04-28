import { useNavigate } from "@tanstack/react-router"
import {
  type UpdateOrganizationInput,
  useActivities,
  useOpportunities,
  useOrganization,
  useOrganizationMutation,
  usePeople,
} from "@voyantjs/crm-react"
import { Button } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import {
  OrganizationMain,
  OrganizationSidebar,
  OrganizationTopBar,
} from "./organization-detail-sections"

export function OrganizationDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<
    "overview" | "people" | "opportunities" | "activities"
  >("overview")
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Organization not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/organizations" })}>
          Back to Organizations
        </Button>
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
    <div className="flex min-h-screen flex-col">
      <OrganizationTopBar
        orgName={org.name}
        onBack={() => void navigate({ to: "/organizations" })}
        deletePending={remove.isPending}
        onDelete={async () => {
          await remove.mutateAsync(id)
          void navigate({ to: "/organizations" })
        }}
      />

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <OrganizationSidebar org={org} websiteHref={websiteHref} onUpdateField={updateField} />
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
          onOpenPerson={(personId) =>
            void navigate({ to: "/people/$id", params: { id: personId } })
          }
          onUpdateField={updateField}
        />
      </div>
    </div>
  )
}
