"use client"

import { createFileRoute, Link } from "@tanstack/react-router"
import { buttonVariants } from "@voyant-travel/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import { LogIn, Route as RouteIcon } from "lucide-react"

import { StorefrontComposerBlock } from "@/components/voyant/trips/storefront-composer-block"
import { authClient } from "@/lib/auth"
import { useStorefrontMessagesOrDefault } from "@/lib/storefront-i18n"

/**
 * The trip composer drives the authenticated `/v1/public/trips/*` surface
 * (create → price → reserve → checkout). Those routes are deliberately NOT on
 * the anonymous allow-list — `listTrips`/`getTrip` have no per-customer scoping,
 * so opening the mount anonymously would leak every tenant trip (see #2642).
 * The composer now uses the storefront customer account entry point so
 * anonymous visitors get a customer-scoped session before creating drafts.
 */
export const Route = createFileRoute("/(storefront)/shop_/composer")({
  component: ComposerRoute,
})

function ComposerRoute(): React.ReactElement | null {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null
  if (!session) return <ComposerSignInGate />
  return <StorefrontComposerBlock />
}

function ComposerSignInGate(): React.ReactElement {
  const t = useStorefrontMessagesOrDefault().composer

  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-md bg-muted">
            <RouteIcon className="size-6 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>{t.gateTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t.gateBody}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/shop/account/sign-in"
              search={{ next: "/shop/composer" }}
              className={buttonVariants()}
            >
              <LogIn className="size-4" aria-hidden="true" />
              {t.gateSignIn}
            </Link>
            <Link to="/shop" className={buttonVariants({ variant: "outline" })}>
              {t.gateBrowse}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
