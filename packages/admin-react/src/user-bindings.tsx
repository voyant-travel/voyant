"use client"

import type { ReactNode } from "react"

import { type AdminUserContextValue, UserProvider, useUser } from "./user.js"

export interface AdminUserBindings<TUser> {
  UserProvider: (props: { children: ReactNode; initialUser?: TUser | null }) => ReactNode
  useUser: () => AdminUserContextValue<TUser>
}

/** Bind the generic admin user context once to a deployment auth runtime. */
export function createAdminUserBindings<TUser>(
  getCurrentUser: () => Promise<TUser | null | undefined>,
): AdminUserBindings<TUser> {
  return {
    UserProvider: ({ children, initialUser }) => (
      <UserProvider getCurrentUser={getCurrentUser} initialUser={initialUser}>
        {children}
      </UserProvider>
    ),
    useUser: () => useUser<TUser>(),
  }
}
