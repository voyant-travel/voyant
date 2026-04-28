import { useNavigate } from "@tanstack/react-router"
import { PersonList } from "@voyantjs/crm-ui/components/person-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function ContactsPage() {
  const messages = useAdminMessages().contacts
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{messages.pageDescription}</p>
      </div>

      <PersonList
        onSelectPerson={(person) => {
          void navigate({ to: "/contacts/$id", params: { id: person.id } })
        }}
      />
    </div>
  )
}
