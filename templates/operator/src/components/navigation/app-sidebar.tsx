import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@voyantjs/ui/components"
import { type NavItem, resolveAdminNavigation } from "@voyantjs/voyant-admin"
import {
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  Mail,
  Package,
  Scale,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import type * as React from "react"
import { NavGroup } from "@/components/navigation/nav-group"
import { NavUser } from "@/components/navigation/nav-user"
import { adminExtensions } from "@/lib/admin-extensions"
import { useAdminMessages } from "@/lib/admin-i18n"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string
    firstName?: string
    lastName?: string
    email?: string
    avatar?: string
  }
}

function AppBrand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
        V
      </div>
      <span className="flex-1 truncate text-sm font-semibold">Voyant</span>
    </div>
  )
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const messages = useAdminMessages()
  const resolvedUser = {
    name: user?.name ?? "",
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
  }
  const baseNavMain: ReadonlyArray<NavItem> = [
    {
      id: "dashboard",
      title: messages.nav.dashboard,
      url: "/",
      icon: LayoutDashboard,
    },
    {
      id: "products",
      title: messages.nav.products,
      url: "/products",
      icon: Package,
      items: [
        { id: "product-categories", title: messages.nav.categories, url: "/products/categories" },
      ],
    },
    {
      id: "bookings",
      title: messages.nav.bookings,
      url: "/bookings",
      icon: CalendarCheck,
    },
    {
      id: "notifications",
      title: messages.nav.notifications,
      url: "/notifications/templates",
      icon: Mail,
      items: [
        {
          id: "notification-templates",
          title: messages.nav.notificationTemplates,
          url: "/notifications/templates",
        },
        {
          id: "notification-reminder-rules",
          title: messages.nav.notificationReminderRules,
          url: "/notifications/reminder-rules",
        },
        {
          id: "notification-deliveries",
          title: messages.nav.notificationDeliveries,
          url: "/notifications/deliveries",
        },
        {
          id: "notification-reminder-runs",
          title: messages.nav.notificationReminderRuns,
          url: "/notifications/reminder-runs",
        },
      ],
    },
    {
      id: "suppliers",
      title: messages.nav.suppliers,
      url: "/suppliers",
      icon: Building2,
    },
    {
      id: "people",
      title: messages.nav.people,
      url: "/people",
      icon: Users,
    },
    {
      id: "organizations",
      title: messages.nav.organizations,
      url: "/organizations",
      icon: Building,
    },
    {
      id: "availability",
      title: messages.nav.availability,
      url: "/availability",
      icon: CalendarDays,
    },
    {
      id: "resources",
      title: messages.nav.resources,
      url: "/resources",
      icon: Wrench,
    },
    {
      id: "finance",
      title: messages.nav.finance,
      url: "/finance",
      icon: DollarSign,
    },
    {
      id: "legal",
      title: messages.nav.legal,
      url: "/legal/contracts",
      icon: Scale,
      items: [
        { id: "contracts", title: messages.nav.contracts, url: "/legal/contracts" },
        {
          id: "contract-templates",
          title: messages.nav.contractTemplates,
          url: "/legal/templates",
        },
        {
          id: "policies",
          title: messages.nav.policies,
          url: "/legal/policies",
        },
        {
          id: "number-series",
          title: messages.nav.contractNumberSeries,
          url: "/legal/number-series",
        },
      ],
    },
    {
      id: "settings",
      title: messages.nav.settings,
      url: "/settings",
      icon: Settings,
    },
  ]
  const navMain = resolveAdminNavigation({
    baseItems: baseNavMain,
    extensions: adminExtensions,
  })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppBrand />
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolvedUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
