"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CustomerAccountPage } from "@voyant-travel/storefront-react/storefront"
import { authClient } from "@/lib/auth"

export const Route = createFileRoute("/(storefront)/shop_/account")({
  component: CustomerAccountRoute,
})

function CustomerAccountRoute(): React.ReactElement | null {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null
  if (!session) {
    void navigate({ to: "/shop/account/sign-in", search: { next: "/shop/account" } })
    return null
  }

  return (
    <CustomerAccountPage
      onSignOut={async () => {
        await authClient.signOut()
        void navigate({ to: "/shop" })
      }}
    />
  )
}
