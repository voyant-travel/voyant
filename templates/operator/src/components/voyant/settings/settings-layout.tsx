import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { cn } from "@voyantjs/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { Building, Hash, Layers, Package, Tag, Tags, Users } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"

type NavItem = { label: string; href: string; icon: LucideIcon }
type NavGroup = { group: string; items: NavItem[] }

export function SettingsLayout() {
  const messages = useAdminMessages()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navGroups: NavGroup[] = [
    {
      group: messages.settings.generalGroup,
      items: [
        { label: messages.settings.operator, href: "/settings/operator", icon: Building },
        { label: messages.settings.team, href: "/settings/team", icon: Users },
        { label: messages.settings.channels, href: "/settings/channels", icon: Hash },
        {
          label: messages.settings.pricingCategories,
          href: "/settings/pricing-categories",
          icon: Tags,
        },
        { label: messages.settings.priceCatalogs, href: "/settings/price-catalogs", icon: Layers },
      ],
    },
    {
      group: messages.settings.productsGroup,
      items: [
        { label: messages.settings.productTypes, href: "/settings/product-types", icon: Package },
        { label: messages.settings.productTags, href: "/settings/product-tags", icon: Tag },
      ],
    },
  ]

  const isActive = (href: string) => pathname.replace(/\/$/, "") === href

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <aside className="w-64 shrink-0 overflow-y-auto border-r p-6">
        <h1 className="text-xl font-semibold tracking-tight">{messages.settings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{messages.settings.description}</p>
        <nav className="mt-6 flex flex-col gap-6">
          {navGroups.map((group) => (
            <div key={group.group}>
              <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.group}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
