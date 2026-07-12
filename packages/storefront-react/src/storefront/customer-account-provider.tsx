"use client"

import { VoyantAuthProvider } from "@voyant-travel/auth-react/provider"
import type { ReactNode } from "react"
import type { VoyantFetcher } from "../customer-portal/client.js"
import { VoyantCustomerPortalProvider } from "../customer-portal/provider.js"

export function rewriteCustomerAccountAuthUrl(url: string): string {
  let target = url
  if (target.includes("/auth/customer/")) {
    return target
  }
  if (target.includes("/auth/")) {
    target = target.replace("/auth/", "/auth/customer/")
  }
  if (target.endsWith("/auth/status")) {
    target = target.replace("/auth/status", "/auth/customer/status")
  }
  return target
}

export function createCustomerAccountFetcher(fetcher: VoyantFetcher): VoyantFetcher {
  return (url, init) => fetcher(rewriteCustomerAccountAuthUrl(url), init)
}

export function CustomerAccountProvider({
  baseUrl,
  children,
  fetcher,
}: {
  baseUrl: string
  children: ReactNode
  fetcher: VoyantFetcher
}) {
  return (
    <VoyantAuthProvider baseUrl={baseUrl} fetcher={createCustomerAccountFetcher(fetcher)}>
      <VoyantCustomerPortalProvider baseUrl={baseUrl} fetcher={fetcher}>
        {children}
      </VoyantCustomerPortalProvider>
    </VoyantAuthProvider>
  )
}
