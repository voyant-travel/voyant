"use client"

import { createContext, type ReactNode, useContext } from "react"

import type { AdminExtension } from "../extensions.js"

const AdminExtensionsContext = createContext<ReadonlyArray<AdminExtension>>([])

export interface AdminExtensionsProviderProps {
  children: ReactNode
  extensions?: ReadonlyArray<AdminExtension>
}

export function AdminExtensionsProvider({
  children,
  extensions = [],
}: AdminExtensionsProviderProps) {
  return (
    <AdminExtensionsContext.Provider value={extensions}>{children}</AdminExtensionsContext.Provider>
  )
}

export function useAdminExtensions(): ReadonlyArray<AdminExtension> {
  return useContext(AdminExtensionsContext)
}
