import { useNavigate } from "@tanstack/react-router"

import { OrganizationList } from "@voyantjs/crm-ui/components/organization-list"

export function OrganizationsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Companies, partners, and accounts in your CRM.
        </p>
      </div>

      <OrganizationList
        onSelectOrganization={(organization) => {
          void navigate({ to: "/organizations/$id", params: { id: organization.id } })
        }}
      />
    </div>
  )
}
