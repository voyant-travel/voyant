import type { QueryClient } from "@tanstack/react-query"
import { AdminProvider } from "@voyantjs/admin"
import { TooltipProvider } from "@voyantjs/ui/components/tooltip"
import type * as React from "react"
import { AdminI18nProvider } from "@/lib/admin-i18n"

export function Providers({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <AdminProvider queryClient={queryClient}>
      <AdminI18nProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </AdminI18nProvider>
    </AdminProvider>
  )
}
