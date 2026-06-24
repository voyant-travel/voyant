import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { ForgotPasswordPage } from "@voyant-travel/auth-react/ui"
import { getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/forgot-password")({
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
  component: ForgotPasswordRoute,
})

function ForgotPasswordRoute() {
  const navigate = useNavigate()

  return (
    <ForgotPasswordPage
      redirectTo="/reset-password"
      signInHref="/sign-in"
      onNavigateToSignIn={() => {
        void navigate({ to: "/sign-in" })
      }}
    />
  )
}
