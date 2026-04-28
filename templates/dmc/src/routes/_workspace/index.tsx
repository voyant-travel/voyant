import { createFileRoute } from "@tanstack/react-router"

import { TypographyH1, TypographyLead } from "@voyantjs/ui/components/typography"
import { useAdminMessages } from "@/lib/admin-i18n"

export const Route = createFileRoute("/_workspace/")({
  component: Dashboard,
})

function Dashboard() {
  const messages = useAdminMessages()

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <TypographyH1 className="text-2xl">{messages.dashboard.title}</TypographyH1>
        <TypographyLead className="mt-2 text-base">{messages.dashboard.description}</TypographyLead>
      </div>
    </div>
  )
}
