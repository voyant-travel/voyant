import type { QueryClient } from "@tanstack/react-query"
import {
  type AdminChildProvider,
  type AdminDomainMessagesProvider,
  OperatorAdminShellProvider,
} from "@voyantjs/admin"
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui/i18n"
import { CrmUiMessagesProvider } from "@voyantjs/crm-ui/i18n"
import { FinanceUiMessagesProvider } from "@voyantjs/finance-ui/i18n"
import { LegalUiMessagesProvider } from "@voyantjs/legal-ui/i18n"
import { NotificationsUiMessagesProvider } from "@voyantjs/notifications-ui/i18n"
import { PricingUiMessagesProvider } from "@voyantjs/pricing-ui/i18n"
import { ProductsUiMessagesProvider } from "@voyantjs/products-ui/i18n"
import { PromotionsUiMessagesProvider } from "@voyantjs/promotions-ui/i18n"
import { ResourcesUiMessagesProvider } from "@voyantjs/resources-ui/i18n"
import { SuppliersUiMessagesProvider } from "@voyantjs/suppliers-ui/i18n"
import { TooltipProvider } from "@voyantjs/ui/components/tooltip"
import type * as React from "react"
import { getApiUrl } from "@/lib/env"

const appProviders = [TooltipProvider] satisfies readonly AdminChildProvider[]

const domainMessageProviders = [
  BookingsUiMessagesProvider,
  ProductsUiMessagesProvider,
  PricingUiMessagesProvider,
  LegalUiMessagesProvider,
  CrmUiMessagesProvider,
  PromotionsUiMessagesProvider,
  ResourcesUiMessagesProvider,
  FinanceUiMessagesProvider,
  NotificationsUiMessagesProvider,
  SuppliersUiMessagesProvider,
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
      queryClient={queryClient}
      providers={appProviders}
      domainMessageProviders={domainMessageProviders}
    >
      {children}
    </OperatorAdminShellProvider>
  )
}
