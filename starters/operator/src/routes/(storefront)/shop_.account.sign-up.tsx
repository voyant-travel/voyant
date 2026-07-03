"use client"

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { SignUpPage, type SignUpPageMessages } from "@voyant-travel/auth-react/ui"
import { buttonVariants } from "@voyant-travel/ui/components/button"
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

  const messages: Partial<SignUpPageMessages> = {
    title: "Create your travel account",
    description: "Save traveler details and manage bookings without using the operator workspace.",
    nameLabel: "Full name",
    emailPlaceholder: "you@example.com",
    submit: "Create account",
    signingUp: "Creating account",
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <SignUpPage
        redirectTo={redirectTo}
        signInHref={`/shop/account/sign-in?next=${encodeURIComponent(redirectTo)}`}
        messages={messages}
        onSignedUp={async ({ email }) => {
          void navigate({
            to: "/shop/account/verify-email",
            search: { email, next: redirectTo },
          })
        }}
      />
      <div className="mt-4 text-center">
        <Link to="/shop" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Back to storefront
        </Link>
      </div>
    </div>
  )
}
