import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@voyantjs/ui/components/tooltip"
import type * as React from "react"

import { ThemeProvider } from "./providers/theme-provider"

export function Providers({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
