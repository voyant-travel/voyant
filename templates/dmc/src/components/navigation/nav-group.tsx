import { Link, useRouterState } from "@tanstack/react-router"
import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@voyantjs/ui/components"
import { ChevronRight, type LucideIcon } from "lucide-react"
import * as React from "react"

import { BETA, COMING_SOON } from "./app-sidebar"

export function NavGroup({
  items,
  label,
  className,
}: {
  label?: string
  className?: string
  items: readonly {
    title: string
    url: string
    icon: LucideIcon | React.ComponentType<{ className?: string }>
    isActive?: boolean
    status?: typeof COMING_SOON | typeof BETA
    target?: string
    items?: readonly {
      title: string
      url: string
      icon?: LucideIcon | React.ComponentType<{ className?: string }>
      status?: typeof COMING_SOON | typeof BETA
      target?: string
    }[]
  }[]
}) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const isActive = (url: string) => {
    if (url === "/") {
      return currentPath === "/"
    }

    if (currentPath.startsWith(url)) {
      if (url !== "/") {
        const nextChar = currentPath.charAt(url.length)
        return nextChar === "/" || nextChar === "" || currentPath === url
      }
    }

    return false
  }

  const isExternalUrl = (url: string) => {
    return url.startsWith("http://") || url.startsWith("https://")
  }

  const renderBadge = (status?: typeof COMING_SOON | typeof BETA) => {
    if (!status) return null

    if (status === COMING_SOON) {
      return (
        <Badge variant="outline" className="ml-auto text-xs">
          Soon
        </Badge>
      )
    }

    if (status === BETA) {
      return (
        <Badge variant="secondary" className="ml-auto text-xs">
          Beta
        </Badge>
      )
    }

    return null
  }

  return (
    <SidebarGroup className={className}>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          if (item.items?.length && item.items.length > 0) {
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} isActive={isActive(item.url)}>
                      {React.createElement(item.icon, {
                        className: "h-4 w-4",
                      })}
                      <span>{item.title}</span>
                      {renderBadge(item.status)}
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          {subItem.status === COMING_SOON ? (
                            <SidebarMenuSubButton
                              className={cn(subItem.status === COMING_SOON && "opacity-50")}
                            >
                              <span>{subItem.title}</span>
                              {renderBadge(subItem.status)}
                            </SidebarMenuSubButton>
                          ) : isExternalUrl(subItem.url) ? (
                            <SidebarMenuSubButton asChild>
                              <a
                                href={subItem.url}
                                target={subItem.target || "_self"}
                                rel={
                                  subItem.target === "_blank" ? "noopener noreferrer" : undefined
                                }
                                onClick={handleLinkClick}
                              >
                                <span>{subItem.title}</span>
                                {renderBadge(subItem.status)}
                              </a>
                            </SidebarMenuSubButton>
                          ) : (
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url} onClick={handleLinkClick}>
                                <span>{subItem.title}</span>
                                {renderBadge(subItem.status)}
                              </Link>
                            </SidebarMenuSubButton>
                          )}
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          } else {
            return (
              <SidebarMenuItem key={item.title}>
                {item.status === COMING_SOON ? (
                  <SidebarMenuButton tooltip={item.title} disabled>
                    {React.createElement(item.icon, { className: "h-4 w-4" })}
                    <span>{item.title}</span>
                    {renderBadge(item.status)}
                  </SidebarMenuButton>
                ) : isExternalUrl(item.url) ? (
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <a
                      href={item.url}
                      target={item.target || "_self"}
                      rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                      onClick={handleLinkClick}
                    >
                      {React.createElement(item.icon, { className: "h-4 w-4" })}
                      <span>{item.title}</span>
                      {renderBadge(item.status)}
                    </a>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <Link to={item.url} onClick={handleLinkClick}>
                      {React.createElement(item.icon, { className: "h-4 w-4" })}
                      <span>{item.title}</span>
                      {renderBadge(item.status)}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )
          }
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
