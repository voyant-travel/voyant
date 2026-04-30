import { useNavigate } from "@tanstack/react-router"

import { PersonList } from "@voyantjs/crm-ui/components/person-list"

export function PeoplePage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-sm text-muted-foreground">
          Manage your clients, partners, and suppliers.
        </p>
      </div>

      <PersonList
        onSelectPerson={(person) => {
          void navigate({ to: "/people/$id", params: { id: person.id } })
        }}
      />
    </div>
  )
}
