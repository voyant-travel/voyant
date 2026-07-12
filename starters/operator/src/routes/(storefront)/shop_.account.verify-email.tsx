"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CustomerVerifyEmailPage } from "@voyant-travel/storefront-react/storefront"
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

  return (
    <CustomerVerifyEmailPage
      email={email}
      redirectTo={redirectTo}
      onCompleted={async () => {
        await authClient.signOut()
      }}
      onResendVerification={async (targetEmail) => {
        await authClient.emailOtp.sendVerificationOtp({
          email: targetEmail,
          type: "email-verification",
        })
      }}
      onNavigateToSignIn={() =>
        void navigate({
          to: "/shop/account/sign-in",
          search: { next: redirectTo, verify: "1" },
        })
      }
    />
  )
}
