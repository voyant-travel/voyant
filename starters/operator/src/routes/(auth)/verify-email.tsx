import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyant-travel/admin/lib/i18n"
import { VerifyEmailPage, type VerifyEmailPageMessages } from "@voyant-travel/auth-react/ui"
import { z } from "zod"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { getLocalAuthRedirect } from "@/lib/local-auth-bootstrap"

export const Route = createFileRoute("/(auth)/verify-email")({
  loader: async ({ location }) => {
    const destination = await getLocalAuthRedirect("verify-email", location.href)
    if (destination) throw redirect(destination)
  },
  validateSearch: z.object({
    email: z.string(),
  }),
  component: VerifyEmailRoute,
})

function VerifyEmailRoute() {
  const navigate = useNavigate()
  const { email } = Route.useSearch()
  const adminMessages = useAdminMessages().auth.verifyEmail

  const messages: Partial<VerifyEmailPageMessages> = {
    title: adminMessages.title,
    description: formatMessage(adminMessages.description, { email }),
    submit: adminMessages.submit,
    verifying: adminMessages.submit,
    invalidVerification: adminMessages.invalidVerificationCode,
    resendCode: adminMessages.resendCode,
    sending: adminMessages.sending,
    resent: adminMessages.resent,
    resendFailed: adminMessages.resendFailed,
  }

  return (
    <VerifyEmailPage
      mode="otp"
      email={email}
      messages={messages}
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
