"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CustomerSignUpPage } from "@voyant-travel/storefront-react/storefront"
import { z } from "zod"

import { authClient } from "@/lib/auth"

export const Route = createFileRoute("/(storefront)/shop_/account/sign-up")({
  validateSearch: z.object({
    next: z.string().optional(),
  }),
  component: CustomerSignUpRoute,
})

function CustomerSignUpRoute(): React.ReactElement | null {
  const navigate = useNavigate()
  const { next } = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const redirectTo = next || "/shop/account"

  if (isPending) return null

  if (session) {
    void navigate({ to: redirectTo })
    return null
  }

  return (
    <CustomerSignUpPage
      redirectTo={redirectTo}
      onNavigateToVerify={(email) =>
        void navigate({
          to: "/shop/account/verify-email",
          search: { email, next: redirectTo },
        })
      }
    />
  )
}
