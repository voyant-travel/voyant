import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { VerifyEmailPage } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { authClient } from "@/lib/auth"
import { getBootstrapStatus, getCurrentUser } from "@/lib/current-user"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/(auth)/verify-email")({
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
    email: z.string(),
  }),
  component: VerifyEmailRoute,
})

function VerifyEmailRoute() {
  const navigate = useNavigate()
  const { email } = Route.useSearch()

  return (
    <VerifyEmailPage
      mode="otp"
      email={email}
      signInHref="/sign-in"
      onCompleted={async () => {
        await fetch(`${getApiUrl()}/auth/status`, { credentials: "include" })
        void navigate({ to: "/" })
      }}
      onResendVerification={async (emailAddress) => {
        await authClient.emailOtp.sendVerificationOtp({
          email: emailAddress,
          type: "email-verification",
        })
      }}
    />
  )
}
