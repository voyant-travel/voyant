import {
  type AnchorHTMLAttributes,
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
} from "react"

export interface StorefrontUiScope {
  marketId?: string
  locale?: string
  currency?: string
}

export interface StorefrontUiMessages {
  shop: Record<string, string>
  shopDetailShared: Record<string, string>
  shopDetailProducts: Record<string, string>
  shopDetailAccommodations: Record<string, string>
  shopDetailCruises: Record<string, string>
}

export interface StorefrontUiNavigation {
  to: string
  params?: Record<string, string>
  search?: Record<string, unknown>
}

export interface StorefrontUiContextValue {
  apiUrl: string
  messages: StorefrontUiMessages
  navigate: (navigation: StorefrontUiNavigation) => void
  scope: StorefrontUiScope
}

const StorefrontUiContext = createContext<StorefrontUiContextValue | null>(null)

export function StorefrontUiProvider({
  children,
  value,
}: {
  children: ReactNode
  value: StorefrontUiContextValue
}): React.ReactElement {
  return <StorefrontUiContext.Provider value={value}>{children}</StorefrontUiContext.Provider>
}

export function useStorefrontUi(): StorefrontUiContextValue {
  const context = useContext(StorefrontUiContext)
  if (!context) throw new Error("useStorefrontUi must be used within StorefrontUiProvider")
  return context
}

export function StorefrontLink({
  children,
  href,
  params,
  search,
  to,
  ...anchorProps
}: AnchorHTMLAttributes<HTMLAnchorElement> & StorefrontUiNavigation): React.ReactElement {
  const { navigate } = useStorefrontUi()

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    anchorProps.onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    navigate({ to, params, search })
  }

  return (
    <a {...anchorProps} href={href ?? to} onClick={onClick}>
      {children}
    </a>
  )
}
