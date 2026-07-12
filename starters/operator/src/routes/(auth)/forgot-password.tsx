import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyant-travel/admin/lib/i18n"
import { ForgotPasswordPage, type ForgotPasswordPageMessages } from "@voyant-travel/auth-react/ui"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getLocalAuthRedirect } from "@/lib/local-auth-bootstrap"

export const Route = createFileRoute("/(auth)/forgot-password")({
  loader: async ({ location }) => {
    const destination = await getLocalAuthRedirect("forgot-password", location.href)
    if (destination) throw redirect(destination)
  },
  component: ForgotPasswordRoute,
})

function ForgotPasswordRoute() {
  const navigate = useNavigate()
  const adminMessages = useAdminMessages().auth.forgotPassword

  const messages: Partial<ForgotPasswordPageMessages> = {
    title: adminMessages.title,
    description: adminMessages.description,
    emailLabel: adminMessages.emailLabel,
    emailPlaceholder: adminMessages.emailPlaceholder,
    submit: adminMessages.submit,
    submitting: adminMessages.submit,
    somethingWentWrong: adminMessages.somethingWentWrong,
    successTitle: adminMessages.checkEmailTitle,
    successDescription: (email) => formatMessage(adminMessages.checkEmailDescription, { email }),
    backToSignIn: adminMessages.backToSignIn,
  }

  return (
    <ForgotPasswordPage
      redirectTo="/reset-password"
      messages={messages}
      onNavigateToSignIn={() => {
        void navigate({ to: "/sign-in" })
      }}
      signInHref="/sign-in"
    />
  )
}
