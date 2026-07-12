import { useLocale } from "@voyant-travel/admin/providers/locale"
import { StorefrontMessagesProvider } from "@voyant-travel/storefront-react/storefront"
import type { ReactNode } from "react"

export function OperatorStorefrontMessagesProvider({ children }: { children: ReactNode }) {
  const { resolvedLocale } = useLocale()
  return <StorefrontMessagesProvider locale={resolvedLocale}>{children}</StorefrontMessagesProvider>
}
