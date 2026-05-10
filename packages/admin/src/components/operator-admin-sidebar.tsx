"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarRail,
} from "@voyantjs/ui/components"
import type * as React from "react"

import type { AdminExtension } from "../extensions.js"
import { resolveAdminNavigation } from "../extensions.js"
import {
  createOperatorAdminNavigation,
  type OperatorAdminNavigationIcons,
} from "../navigation/operator-navigation.js"
import { AdminExtensionsProvider } from "../providers/admin-extensions.js"
import { useOperatorAdminMessages } from "../providers/operator-admin-messages.js"
import type { AdminUser, NavItem } from "../types.js"
import { AdminNavGroup } from "./admin-nav-group.js"
import type { AdminNavLinkComponent } from "./admin-nav-link.js"
import { OperatorAdminUserMenu } from "./operator-admin-user-menu.js"

export interface OperatorAdminSidebarProps
  extends Omit<React.ComponentProps<typeof Sidebar>, "children"> {
  accountHref?: string
  brand?: React.ReactNode
  currentPath: string
  extensions?: ReadonlyArray<AdminExtension>
  icons?: OperatorAdminNavigationIcons
  linkComponent?: AdminNavLinkComponent
  navItems?: ReadonlyArray<NavItem>
  onSignOut?: () => void | Promise<void>
  user?: AdminUser | null
}

export function DefaultOperatorAdminBrand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
        V
      </div>
      <span className="flex-1 truncate text-sm font-semibold">Voyant</span>
    </div>
  )
}

export function OperatorAdminSidebar({
  accountHref,
  brand = <DefaultOperatorAdminBrand />,
  currentPath,
  extensions,
  icons,
  linkComponent,
  navItems,
  onSignOut,
  user,
  ...props
}: OperatorAdminSidebarProps) {
  const messages = useOperatorAdminMessages()
  const baseItems = navItems ?? createOperatorAdminNavigation({ icons, messages: messages.nav })
  const resolvedItems = resolveAdminNavigation({ baseItems, extensions })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{brand}</SidebarHeader>
      <SidebarContent>
        <AdminNavGroup
          currentPath={currentPath}
          items={resolvedItems}
          linkComponent={linkComponent}
        />
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <OperatorAdminUserMenu
            accountHref={accountHref}
            linkComponent={linkComponent}
            onSignOut={onSignOut}
            user={user}
          />
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}

export interface OperatorAdminWorkspaceLayoutProps {
  accountHref?: string
  brand?: React.ReactNode
  children: React.ReactNode
  currentPath: string
  extensions?: ReadonlyArray<AdminExtension>
  icons?: OperatorAdminNavigationIcons
  linkComponent?: AdminNavLinkComponent
  mainClassName?: string
  navItems?: ReadonlyArray<NavItem>
  onSignOut?: () => void | Promise<void>
  sidebarProps?: Omit<OperatorAdminSidebarProps, "currentPath">
  user?: AdminUser | null
}

export function OperatorAdminWorkspaceLayout({
  accountHref,
  brand,
  children,
  currentPath,
  extensions,
  icons,
  linkComponent,
  mainClassName = "flex-1",
  navItems,
  onSignOut,
  sidebarProps,
  user,
}: OperatorAdminWorkspaceLayoutProps) {
  return (
    <AdminExtensionsProvider extensions={extensions}>
      <SidebarProvider>
        <OperatorAdminSidebar
          accountHref={accountHref}
          brand={brand}
          currentPath={currentPath}
          extensions={extensions}
          icons={icons}
          linkComponent={linkComponent}
          navItems={navItems}
          onSignOut={onSignOut}
          user={user}
          {...sidebarProps}
        />
        <main className={mainClassName}>{children}</main>
      </SidebarProvider>
    </AdminExtensionsProvider>
  )
}
