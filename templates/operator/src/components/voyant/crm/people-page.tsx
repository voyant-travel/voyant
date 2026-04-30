import { useNavigate } from "@tanstack/react-router"
import { PersonList } from "@voyantjs/crm-ui/components/person-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function PeoplePage() {
  const navigate = useNavigate()
  const messages = useAdminMessages().crm.peoplePage

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <PersonList
        onSelectPerson={(person) => {
          void navigate({ to: "/people/$id", params: { id: person.id } })
        }}
      />
    </div>
  )
}
