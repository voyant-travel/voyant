"use client"

import {
  cn,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
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
import { type AdminNavLinkComponent, DefaultAdminNavLink } from "./admin-nav-link.js"
import { VoyantMark } from "./brand/voyant-mark.js"
import { VoyantWordmark } from "./brand/voyant-wordmark.js"
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

export interface DefaultOperatorAdminBrandProps {
  href?: string
  linkComponent?: AdminNavLinkComponent
}

export function DefaultOperatorAdminBrand({
  href = "/",
  linkComponent: LinkComponent = DefaultAdminNavLink,
}: DefaultOperatorAdminBrandProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Voyant" size="lg">
          <LinkComponent href={href} target="_self" aria-label="Voyant">
            <VoyantMark
              aria-hidden="true"
              className="hidden! size-5! shrink-0 group-data-[collapsible=icon]:block!"
            />
            <VoyantWordmark
              aria-hidden="true"
              className="h-6! w-auto! group-data-[collapsible=icon]:hidden!"
            />
          </LinkComponent>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function OperatorAdminSidebar({
  accountHref,
  brand,
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
  const resolvedBrand = brand ?? <DefaultOperatorAdminBrand linkComponent={linkComponent} />

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{resolvedBrand}</SidebarHeader>
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
  defaultOpen?: React.ComponentProps<typeof SidebarProvider>["defaultOpen"]
  extensions?: ReadonlyArray<AdminExtension>
  headerClassName?: string
  headerSlot?: React.ReactNode
  icons?: OperatorAdminNavigationIcons
  linkComponent?: AdminNavLinkComponent
  mainClassName?: string
  navItems?: ReadonlyArray<NavItem>
  onSignOut?: () => void | Promise<void>
  side?: React.ComponentProps<typeof Sidebar>["side"]
  sidebarProps?: Omit<OperatorAdminSidebarProps, "currentPath">
  showSidebarTrigger?: boolean
  user?: AdminUser | null
  variant?: React.ComponentProps<typeof Sidebar>["variant"]
}

export function OperatorAdminWorkspaceLayout({
  accountHref,
  brand,
  children,
  currentPath,
  defaultOpen,
  extensions,
  headerClassName,
  headerSlot,
  icons,
  linkComponent,
  mainClassName = "flex-1",
  navItems,
  onSignOut,
  side,
  sidebarProps,
  showSidebarTrigger = true,
  user,
  variant,
}: OperatorAdminWorkspaceLayoutProps) {
  const resolvedSide = sidebarProps?.side ?? side
  const sidebar = (
    <OperatorAdminSidebar
      accountHref={accountHref}
      brand={brand}
      currentPath={currentPath}
      extensions={extensions}
      icons={icons}
      linkComponent={linkComponent}
      navItems={navItems}
      onSignOut={onSignOut}
      side={side}
      user={user}
      variant={variant}
      {...sidebarProps}
    />
  )
  const inset = (
    <SidebarInset className={mainClassName}>
      {(showSidebarTrigger || headerSlot) && (
        <header
          className={cn(
            "flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12",
            headerClassName,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {showSidebarTrigger && (
              <SidebarTrigger
                className="-ml-1"
                title="Toggle sidebar (Cmd/Ctrl+B)"
                aria-label="Toggle sidebar"
              />
            )}
            {headerSlot}
          </div>
        </header>
      )}
      {children}
    </SidebarInset>
  )

  return (
    <AdminExtensionsProvider extensions={extensions}>
      <SidebarProvider defaultOpen={defaultOpen}>
        {resolvedSide === "right" ? (
          <>
            {inset}
            {sidebar}
          </>
        ) : (
          <>
            {sidebar}
            {inset}
          </>
        )}
      </SidebarProvider>
    </AdminExtensionsProvider>
  )
}
