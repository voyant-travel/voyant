"use client"

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { SignInPage, type SignInPageMessages } from "@voyant-travel/auth-react/ui"
import { useCustomerPortalMutation } from "@voyant-travel/storefront-react/customer-portal/hooks"
import { buttonVariants } from "@voyant-travel/ui/components/button"
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
  const customerPortal = useCustomerPortalMutation()
  const redirectTo = next || "/shop/account"

  if (isPending) return null

  if (session) {
    void navigate({ to: redirectTo })
    return null
  }

  const messages: Partial<SignInPageMessages> = {
    title: "Sign in to your travel account",
    description: "Access your profile, saved travelers, documents, and bookings.",
    emailPlaceholder: "you@example.com",
    submit: "Sign in",
    signingIn: "Signing in",
  }

  return (
    <div className="mx-auto max-w-md py-10">
      {verify && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-900 text-sm">
          Email verified. Sign in to continue.
        </div>
      )}
      <SignInPage
        redirectTo={redirectTo}
        signUpHref={`/shop/account/sign-up?next=${encodeURIComponent(redirectTo)}`}
        messages={messages}
        onSignedIn={async () => {
          await customerPortal.bootstrap.mutateAsync({ createCustomerIfMissing: true })
          void navigate({ to: redirectTo })
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
