"use client"

import { VoyantAuthProvider } from "@voyant-travel/auth-react/provider"
import type { VoyantFetcher } from "@voyant-travel/storefront-react/customer-portal/client"
import { VoyantCustomerPortalProvider } from "@voyant-travel/storefront-react/customer-portal/provider"
import type { ReactNode } from "react"
import { getApiUrl } from "./env"
import { operatorFetcher } from "./voyant-fetcher"

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

export const customerAccountFetcher: VoyantFetcher = (url, init) => {
  const target = rewriteCustomerAccountAuthUrl(url)
  return operatorFetcher(target, init)
}

export function CustomerAccountProvider({ children }: { children: ReactNode }) {
  const baseUrl = getApiUrl()

  return (
    <VoyantAuthProvider baseUrl={baseUrl} fetcher={customerAccountFetcher}>
      <VoyantCustomerPortalProvider baseUrl={baseUrl} fetcher={operatorFetcher}>
        {children}
      </VoyantCustomerPortalProvider>
    </VoyantAuthProvider>
  )
}
