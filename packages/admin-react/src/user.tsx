"use client"

import { type QueryKey, useQuery } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext } from "react"

/** The current-user context the admin shell reads. */
export interface AdminUserContextValue<TUser> {
  user: TUser | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
}

const UserContext = createContext<AdminUserContextValue<unknown> | undefined>(undefined)

export interface UserProviderProps<TUser> {
  children: ReactNode
  /** Resolves the current user; typically the deployment's auth-runtime `getCurrentUser`. */
  getCurrentUser: () => Promise<TUser | null | undefined>
  /** SSR-hydrated initial user, when the route loader already resolved it. */
  initialUser?: TUser | null
  /** Query key for the current-user query. Defaults to `["current-user"]`. */
  queryKey?: QueryKey
}

/**
 * Provides the current user to the admin workspace via React Query. The
 * deployment injects `getCurrentUser` (its auth-runtime port), so this provider
 * carries no auth-client dependency and is reusable across managed and
 * self-host admin hosts.
 */
export function UserProvider<TUser>({
  children,
  getCurrentUser,
  initialUser,
  queryKey = ["current-user"],
}: UserProviderProps<TUser>) {
  const {
    data: user,
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => getCurrentUser(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    ...(initialUser !== undefined ? { initialData: initialUser } : {}),
  })

  const isLoading = isPending || (isFetching && user === undefined)

  return (
    <UserContext.Provider
      value={{
        user: (user ?? null) as TUser | null,
        isLoading,
        error: error ?? null,
        refetch,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

/** Read the current user from {@link UserProvider}. Throws when used outside it. */
export function useUser<TUser>(): AdminUserContextValue<TUser> {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within UserProvider")
  }
  return context as AdminUserContextValue<TUser>
}
