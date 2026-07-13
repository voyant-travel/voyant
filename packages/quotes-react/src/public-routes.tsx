"use client"

import { useParams } from "@tanstack/react-router"
import type { ComponentType, ReactNode } from "react"
import type { PublicProposalPageMessages } from "./storefront/public-proposal-page.js"
import { PublicProposalPage } from "./storefront/public-proposal-page.js"

export interface QuotesPublicRouteRuntime {
  getApiUrl(): string
  StorefrontMessagesProvider: ComponentType<{ children: ReactNode }>
  useProposalMessages(): PublicProposalPageMessages
}

export function createQuotesPublicRouteContribution(runtime: QuotesPublicRouteRuntime) {
  function ProposalRoute() {
    return (
      <runtime.StorefrontMessagesProvider>
        <ProposalRouteContent />
      </runtime.StorefrontMessagesProvider>
    )
  }

  function ProposalRouteContent() {
    const { quoteVersionId } = useParams({ strict: false }) as { quoteVersionId: string }
    return (
      <PublicProposalPage
        quoteVersionId={quoteVersionId}
        apiBaseUrl={runtime.getApiUrl()}
        messages={runtime.useProposalMessages()}
      />
    )
  }

  return {
    id: "@voyant-travel/quotes-react#public-routes" as const,
    routes: { proposal: { component: ProposalRoute } },
  }
}
