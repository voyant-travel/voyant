"use client"

import {
  type AdminUserContextValue,
  UserProvider as AdminUserProvider,
  useUser as useAdminUser,
} from "@voyant-travel/admin-react/user"
import type { ReactNode } from "react"

import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import type { CurrentUser } from "@/lib/current-user"

/**
 * Operator current-user provider — a thin adopter of the packaged
 * `@voyant-travel/admin-react/user` provider, wired to the deployment's auth
 * runtime (`getCurrentUser`). Kept as a local module so the ~app-wide `useUser`
 * import path and the `CurrentUser` type stay stable.
 */
export function UserProvider({
  children,
  initialUser,
}: {
  children: ReactNode
  initialUser?: CurrentUser | null
}) {
  return (
    <AdminUserProvider<CurrentUser>
      getCurrentUser={adminAuthRuntime.getCurrentUser}
      initialUser={initialUser}
    >
      {children}
    </AdminUserProvider>
  )
}

export function useUser(): AdminUserContextValue<CurrentUser> {
  return useAdminUser<CurrentUser>()
}
