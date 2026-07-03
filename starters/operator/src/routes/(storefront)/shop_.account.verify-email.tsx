"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { VerifyEmailPage, type VerifyEmailPageMessages } from "@voyant-travel/auth-react/ui"
import { z } from "zod"

import { authClient } from "@/lib/auth"

export const Route = createFileRoute("/(storefront)/shop_/account/verify-email")({
  validateSearch: z.object({
    email: z.string().optional(),
    next: z.string().optional(),
  }),
  component: CustomerVerifyEmailRoute,
})

function CustomerVerifyEmailRoute(): React.ReactElement {
  const navigate = useNavigate()
  const { email, next } = Route.useSearch()
  const redirectTo = next || "/shop/account"

  const messages: Partial<VerifyEmailPageMessages> = {
    title: "Verify your email",
    description: "Enter the verification code we sent before signing in.",
    successTitle: "Email verified",
    successDescription: "Your travel account is ready.",
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <VerifyEmailPage
        mode="otp"
        email={email}
        signInHref={`/shop/account/sign-in?next=${encodeURIComponent(redirectTo)}&verify=1`}
        messages={messages}
        onCompleted={async () => {
          await authClient.signOut()
        }}
        onResendVerification={async (targetEmail) => {
          await authClient.emailOtp.sendVerificationOtp({
            email: targetEmail,
            type: "email-verification",
          })
        }}
        onSignInClick={() => {
          void navigate({
            to: "/shop/account/sign-in",
            search: { next: redirectTo, verify: "1" },
          })
        }}
      />
    </div>
  )
}
