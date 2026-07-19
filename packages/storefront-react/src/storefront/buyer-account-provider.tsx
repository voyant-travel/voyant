"use client"

import {
  type CustomerAuthFetcher,
  type CustomerAuthSession,
  type CustomerBuyerAccount,
  type CustomerBuyerAccountList,
  createCustomerAuthClient,
} from "@voyant-travel/storefront/customer-auth-client"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { VoyantFetcher } from "../customer-portal/client.js"

export type BuyerAccountPolicy = CustomerBuyerAccountList["policy"]

export interface BuyerAccountContextValue {
  accounts: CustomerBuyerAccount[]
  active: CustomerBuyerAccount | null
  requiresSelection: boolean
  policy: BuyerAccountPolicy | null
  session: CustomerAuthSession
  loading: boolean
  selecting: boolean
  error: Error | null
  refresh: () => Promise<void>
  selectAccount: (accountId: string) => Promise<void>
}

const BuyerAccountContext = createContext<BuyerAccountContextValue | null>(null)

/** Force cookie-backed customer auth through the storefront's same-origin BFF. */
export function createBuyerAccountFetcher(fetcher: VoyantFetcher): CustomerAuthFetcher {
  return (url, init) => fetcher(url, { ...init, credentials: "include" })
}

export function BuyerAccountProvider({
  baseUrl,
  children,
  fetcher,
}: {
  baseUrl: string
  children: ReactNode
  fetcher: VoyantFetcher
}) {
  const client = useMemo(
    () =>
      createCustomerAuthClient({
        baseUrl,
        fetcher: createBuyerAccountFetcher(fetcher),
      }),
    [baseUrl, fetcher],
  )
  const requestVersion = useRef(0)
  const [accounts, setAccounts] = useState<CustomerBuyerAccount[]>([])
  const [active, setActive] = useState<CustomerBuyerAccount | null>(null)
  const [requiresSelection, setRequiresSelection] = useState(false)
  const [policy, setPolicy] = useState<BuyerAccountPolicy | null>(null)
  const [session, setSession] = useState<CustomerAuthSession>(null)
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError(null)
    try {
      const [accountState, sessionState] = await Promise.all([
        client.listBuyerAccounts(),
        client.getSession(),
      ])
      if (version !== requestVersion.current) return
      setAccounts(accountState.accounts)
      setActive(accountState.activeAccount)
      setRequiresSelection(accountState.requiresSelection)
      setPolicy(accountState.policy)
      setSession(sessionState)
    } catch (cause) {
      if (version !== requestVersion.current) return
      setError(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void refresh()
    return () => {
      requestVersion.current += 1
    }
  }, [refresh])

  const selectAccount = useCallback(
    async (accountId: string) => {
      setSelecting(true)
      setError(null)
      try {
        await client.selectBuyerAccount(accountId)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        throw cause
      } finally {
        setSelecting(false)
      }
    },
    [client, refresh],
  )

  const value = useMemo<BuyerAccountContextValue>(
    () => ({
      accounts,
      active,
      requiresSelection,
      policy,
      session,
      loading,
      selecting,
      error,
      refresh,
      selectAccount,
    }),
    [
      accounts,
      active,
      requiresSelection,
      policy,
      session,
      loading,
      selecting,
      error,
      refresh,
      selectAccount,
    ],
  )

  return <BuyerAccountContext.Provider value={value}>{children}</BuyerAccountContext.Provider>
}

export function useBuyerAccounts(): BuyerAccountContextValue {
  const value = useContext(BuyerAccountContext)
  if (!value) {
    throw new Error("useBuyerAccounts must be used inside BuyerAccountProvider")
  }
  return value
}

export function BuyerAccountSelector({
  className,
  disabled = false,
}: {
  className?: string
  disabled?: boolean
}) {
  const { accounts, active, selectAccount, selecting } = useBuyerAccounts()
  return (
    <fieldset className={className} aria-label="Buyer account">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          aria-pressed={active?.id === account.id}
          disabled={disabled || selecting}
          onClick={() => void selectAccount(account.id)}
        >
          <span>{account.name}</span>
          <span>{account.kind === "business" ? "Business" : "Personal"}</span>
        </button>
      ))}
    </fieldset>
  )
}

export function BuyerAccountSelectionGate({
  children,
  errorFallback,
  loadingFallback = null,
  selectionFallback,
}: {
  children: ReactNode
  errorFallback?: (error: Error) => ReactNode
  loadingFallback?: ReactNode
  selectionFallback?: ReactNode
}) {
  const state = useBuyerAccounts()
  if (state.loading) return loadingFallback
  if (state.error) return errorFallback?.(state.error) ?? null
  if (state.requiresSelection) {
    return selectionFallback ?? <BuyerAccountSelector />
  }
  return children
}
