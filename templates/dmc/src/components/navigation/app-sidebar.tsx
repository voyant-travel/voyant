import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@voyantjs/ui/components"
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Globe2,
  LayoutDashboard,
  Mail,
  Package,
  Users,
  Wrench,
} from "lucide-react"
import type * as React from "react"
import { NavGroup } from "@/components/navigation/nav-group"
import { NavUser } from "@/components/navigation/nav-user"
import { useAdminMessages } from "@/lib/admin-i18n"

export const COMING_SOON = "COMING_SOON" as const
export const BETA = "BETA" as const

const baseData = {
  user: {
    name: "",
    email: "",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Contacts",
      url: "/contacts",
      icon: Users,
    },
    {
      title: "Suppliers",
      url: "/suppliers",
      icon: Building2,
    },
    {
      title: "Products",
      url: "/products",
      icon: Package,
    },
    {
      title: "Availability",
      url: "/availability",
      icon: CalendarDays,
    },
    {
      title: "Resources",
      url: "/resources",
      icon: Wrench,
    },
    {
      title: "Bookings",
      url: "/bookings",
      icon: CalendarCheck,
    },
    {
      title: "Distribution",
      url: "/distribution",
      icon: Globe2,
    },
    {
      title: "Finance",
      url: "/finance",
      icon: DollarSign,
    },
  ],
} as const

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
    name: user?.name ?? baseData.user.name,
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email ?? baseData.user.email,
    avatar: user?.avatar ?? baseData.user.avatar,
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppBrand />
      </SidebarHeader>
      <SidebarContent>
        <NavGroup
          items={[
            {
              ...baseData.navMain[0],
              title: messages.nav.dashboard,
            },
            {
              ...baseData.navMain[1],
              title: messages.nav.contacts,
            },
            {
              ...baseData.navMain[2],
              title: messages.nav.suppliers,
            },
            {
              ...baseData.navMain[3],
              title: messages.nav.products,
            },
            {
              ...baseData.navMain[4],
              title: messages.nav.availability,
            },
            {
              ...baseData.navMain[5],
              title: messages.nav.resources,
            },
            {
              ...baseData.navMain[6],
              title: messages.nav.bookings,
            },
            {
              title: messages.nav.notifications,
              url: "/notifications/templates",
              icon: Mail,
              items: [
                {
                  title: messages.nav.notificationTemplates,
                  url: "/notifications/templates",
                },
                {
                  title: messages.nav.notificationReminderRules,
                  url: "/notifications/reminder-rules",
                },
                {
                  title: messages.nav.notificationDeliveries,
                  url: "/notifications/deliveries",
                },
                {
                  title: messages.nav.notificationReminderRuns,
                  url: "/notifications/reminder-runs",
                },
              ],
            },
            {
              ...baseData.navMain[7],
              title: messages.nav.distribution,
            },
            {
              ...baseData.navMain[8],
              title: messages.nav.finance,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolvedUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
