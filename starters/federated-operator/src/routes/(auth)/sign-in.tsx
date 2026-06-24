import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { SignInPage } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { authClient } from "@/lib/auth"
import { getBootstrapStatus, getCurrentUser } from "@/lib/current-user"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(auth)/sign-in")({
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
    next: z.string().optional(),
    redirect_url: z.string().optional(),
    reset: z.string().optional(),
  }),
  component: SignInRoute,
})

function SignInRoute() {
  const navigate = useNavigate()
  const { next, redirect_url } = Route.useSearch()
  const redirectTo = next || redirect_url || "/"

  return (
    <SignInPage
      redirectTo={redirectTo}
      forgotPasswordHref="/forgot-password"
      onSignedIn={async () => {
        await fetch(`${getApiUrl()}/auth/status`, { credentials: "include" })
        void navigate({ href: redirectTo })
      }}
      onResendVerification={async (email) => {
        await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
        void navigate({ to: "/verify-email", search: { email } })
      }}
    />
  )
}
