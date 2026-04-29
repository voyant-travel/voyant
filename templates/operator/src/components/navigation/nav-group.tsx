import { Link, useRouterState } from "@tanstack/react-router"
import { BETA, COMING_SOON, type NavItem } from "@voyantjs/admin"
import {
  Badge,
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
import * as React from "react"

export function NavGroup({
  items,
  label,
  className,
}: {
  label?: string
  className?: string
  items: ReadonlyArray<NavItem>
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
            const parentActive = isActive(item.url)
            const anyChildActive = item.items.some((sub) => isActive(sub.url))
            const expanded = parentActive || anyChildActive

            return (
              <SidebarMenuItem key={item.id ?? item.url ?? item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={parentActive}>
                  <Link to={item.url} onClick={handleLinkClick}>
                    {item.icon
                      ? React.createElement(item.icon, {
                          className: "h-4 w-4",
                        })
                      : null}
                    <span>{item.title}</span>
                    {renderBadge(item.status)}
                  </Link>
                </SidebarMenuButton>
                {expanded && (
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.id ?? subItem.url ?? subItem.title}>
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
                              rel={subItem.target === "_blank" ? "noopener noreferrer" : undefined}
                              onClick={handleLinkClick}
                            >
                              <span>{subItem.title}</span>
                              {renderBadge(subItem.status)}
                            </a>
                          </SidebarMenuSubButton>
                        ) : (
                          <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                            <Link to={subItem.url} onClick={handleLinkClick}>
                              <span>{subItem.title}</span>
                              {renderBadge(subItem.status)}
                            </Link>
                          </SidebarMenuSubButton>
                        )}
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            )
          } else {
            return (
              <SidebarMenuItem key={item.id ?? item.url ?? item.title}>
                {item.status === COMING_SOON ? (
                  <SidebarMenuButton tooltip={item.title} disabled>
                    {item.icon ? React.createElement(item.icon, { className: "h-4 w-4" }) : null}
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
                      {item.icon ? React.createElement(item.icon, { className: "h-4 w-4" }) : null}
                      <span>{item.title}</span>
                      {renderBadge(item.status)}
                    </a>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                    <Link to={item.url} onClick={handleLinkClick}>
                      {item.icon ? React.createElement(item.icon, { className: "h-4 w-4" }) : null}
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
