"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { Globe } from "lucide-react"

import { useAuthUiI18nOrDefault } from "../i18n/provider.js"

/**
 * Sites sub-view of the Storefronts surface.
 *
 * "Sites" is the hosting/deployment aspect of a `cloud_site` storefront. In the
 * self-host framework the deployment of a site is a MANAGED-ONLY capability, so
 * this reparented route renders the documented seam: the nav entry and route
 * now live under Storefronts, and a managed deployment plugs its site
 * management UI in here (replace this placeholder with the managed sites
 * surface, or contribute a route with the same id from the managed graph).
 */
export function StorefrontSitesPage() {
  const copy = useAuthUiI18nOrDefault().messages.storefrontsPage.sites
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" aria-hidden="true" />
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{copy.seam}</CardContent>
      </Card>
    </div>
  )
}
