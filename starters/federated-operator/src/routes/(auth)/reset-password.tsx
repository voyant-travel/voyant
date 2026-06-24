import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { ResetPasswordPage } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/reset-password")({
  loader: async () => {
    const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

    if (user) {
      throw redirect({ to: "/" })
    }

    if (!bootstrap.hasUsers) {
      throw redirect({ to: "/sign-up" })
    }

    return null
  },
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: ResetPasswordRoute,
})

function ResetPasswordRoute() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()

  return (
    <ResetPasswordPage
      token={token}
      signInHref="/sign-in"
      onPasswordReset={() => {
        void navigate({ to: "/sign-in", search: { reset: "success" } })
      }}
      onNavigateToSignIn={() => {
        void navigate({ to: "/sign-in" })
      }}
    />
  )
}
