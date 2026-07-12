"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CustomerSignInPage } from "@voyant-travel/storefront-react/storefront"
import { z } from "zod"
import { authClient } from "@/lib/auth"

export const Route = createFileRoute("/(storefront)/shop_/account/sign-in")({
  validateSearch: z.object({
    next: z.string().optional(),
    verify: z.string().optional(),
  }),
  component: CustomerSignInRoute,
})

function CustomerSignInRoute(): React.ReactElement | null {
  const navigate = useNavigate()
  const { next, verify } = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const redirectTo = next || "/shop/account"

  if (isPending) return null

  if (session) {
    void navigate({ to: redirectTo })
    return null
  }

  return (
    <CustomerSignInPage
      redirectTo={redirectTo}
      verified={Boolean(verify)}
      onNavigate={(to) => void navigate({ to })}
    />
  )
}
