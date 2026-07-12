import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { AcceptInvitationPage } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { getLocalAuthRedirect } from "@/lib/local-auth-bootstrap"

export const Route = createFileRoute("/(auth)/accept-invitation")({
  validateSearch: z.object({
    id: z.string(),
  }),
  loader: async ({ location }) => {
    const destination = await getLocalAuthRedirect("accept-invitation", location.href)
    if (destination) throw redirect(destination)
  },
  component: AcceptInvitationRoute,
})

function AcceptInvitationRoute() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()

  return (
    <AcceptInvitationPage
      token={id}
      isAuthenticated
      continueHref="/"
      onContinue={() => {
        void navigate({ to: "/" })
      }}
    />
  )
}
