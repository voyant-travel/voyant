import type { QueryClient } from "@tanstack/react-query"
import {
  type AdminChildProvider,
  type AdminDomainMessagesProvider,
  OperatorAdminShellProvider,
} from "@voyant-travel/admin/providers/operator-admin-shell"
import { AuthUiMessagesProvider } from "@voyant-travel/auth-react/i18n"
import { CrmUiMessagesProvider } from "@voyant-travel/relationships-react/i18n"
import { TooltipProvider } from "@voyant-travel/ui/components/tooltip"
import { WorkflowRunsUiMessagesProvider } from "@voyant-travel/workflows-react/i18n"
import type * as React from "react"
import { getApiUrl } from "@/lib/env"
import { federatedOperatorFetcher } from "@/lib/voyant-fetcher"

const appProviders = [TooltipProvider] satisfies readonly AdminChildProvider[]

const domainMessageProviders = [
  AuthUiMessagesProvider,
  CrmUiMessagesProvider,
  WorkflowRunsUiMessagesProvider,
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
      fetcher={federatedOperatorFetcher}
      queryClient={queryClient}
      providers={appProviders}
      domainMessageProviders={domainMessageProviders}
    >
      {children}
    </OperatorAdminShellProvider>
  )
}
