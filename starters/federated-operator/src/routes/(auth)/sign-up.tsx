import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { SignUpPage } from "@voyant-travel/auth-react/ui"
import { getBootstrapStatus, getCurrentUser } from "@/lib/current-user"

export const Route = createFileRoute("/(auth)/sign-up")({
  loader: async () => {
    const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

    if (user) {
      throw redirect({ to: "/" })
    }

    if (bootstrap.hasUsers) {
      throw redirect({ to: "/sign-in" })
    }

    return null
  },
  component: SignUpRoute,
})

function SignUpRoute() {
  const navigate = useNavigate()

  return (
    <SignUpPage
      signInHref="/sign-in"
      onSignedUp={async ({ email }) => {
        void navigate({ to: "/verify-email", search: { email } })
      }}
    />
  )
}
