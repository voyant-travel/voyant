"use client"

import { createFileRoute } from "@tanstack/react-router"
import { useStorefrontMessagesOrDefault } from "@voyant-travel/storefront-react/storefront"
import { StorefrontComposerPage } from "@voyant-travel/trips-react/storefront"
import { useAdminMessages } from "@/lib/admin-i18n"
import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"

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
  const storefrontMessages = useStorefrontMessagesOrDefault()
  const composerMessages = useAdminMessages().trips.storefrontComposer

  if (isPending) return null
  return (
    <StorefrontComposerPage
      apiUrl={getApiUrl()}
      gateMessages={storefrontMessages.composer}
      messages={composerMessages}
      signedIn={Boolean(session)}
    />
  )
}
