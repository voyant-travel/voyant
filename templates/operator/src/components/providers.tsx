import type { QueryClient } from "@tanstack/react-query"
import {
  type AdminChildProvider,
  type AdminDomainMessagesProvider,
  OperatorAdminShellProvider,
} from "@voyantjs/admin"
import { AuthUiMessagesProvider } from "@voyantjs/auth-react/i18n"
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-react/i18n"
import { CatalogUiMessagesProvider } from "@voyantjs/catalog-react/i18n"
import { CommerceUiMessagesProvider } from "@voyantjs/commerce-react/i18n"
import { SuppliersUiMessagesProvider } from "@voyantjs/distribution-react/suppliers/i18n"
import { FinanceUiMessagesProvider } from "@voyantjs/finance-react/i18n"
import { ProductsUiMessagesProvider } from "@voyantjs/inventory-react/i18n"
import { LegalUiMessagesProvider } from "@voyantjs/legal-react/i18n"
import { NotificationsUiMessagesProvider } from "@voyantjs/notifications-react/i18n"
import { AllocationUiMessagesProvider } from "@voyantjs/operations-react/availability/allocation/i18n"
// Provider subpath on purpose: the availability main barrel re-exports the
// whole data layer (schemas pull `@voyantjs/operations/availability` validation), and
// this module evaluates with workspace chrome — the `/provider` entry is
// the lean context-only module.
import { VoyantAvailabilityProvider } from "@voyantjs/operations-react/availability/provider"
import { ResourcesUiMessagesProvider } from "@voyantjs/operations-react/resources/i18n"
import { CrmUiMessagesProvider } from "@voyantjs/relationships-react/i18n"
import { TooltipProvider } from "@voyantjs/ui/components/tooltip"
import type * as React from "react"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// VoyantAvailabilityProvider needs a baseUrl prop — wrap it once so it
// fits the child-only AdminChildProvider shape used by the admin shell.
const AvailabilityProvider: AdminChildProvider = ({ children }) => (
  <VoyantAvailabilityProvider baseUrl={getApiUrl()}>{children}</VoyantAvailabilityProvider>
)

const appProviders = [TooltipProvider, AvailabilityProvider] satisfies readonly AdminChildProvider[]

const domainMessageProviders = [
  // Localizes the packaged account + API tokens pages (auth-react reads
  // these messages; without the provider it falls back to English).
  AuthUiMessagesProvider,
  BookingsUiMessagesProvider,
  CatalogUiMessagesProvider,
  ProductsUiMessagesProvider,
  CommerceUiMessagesProvider,
  LegalUiMessagesProvider,
  CrmUiMessagesProvider,
  ResourcesUiMessagesProvider,
  FinanceUiMessagesProvider,
  NotificationsUiMessagesProvider,
  SuppliersUiMessagesProvider,
  AllocationUiMessagesProvider,
] satisfies readonly AdminDomainMessagesProvider[]

export function Providers({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <OperatorAdminShellProvider
      baseUrl={getApiUrl()}
      fetcher={operatorFetcher}
      queryClient={queryClient}
      providers={appProviders}
      domainMessageProviders={domainMessageProviders}
    >
      {children}
    </OperatorAdminShellProvider>
  )
}
