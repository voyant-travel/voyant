import {
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  Library,
  Mail,
  Package,
  Plane,
  Radio,
  Scale,
  Settings,
  Users,
  Wrench,
} from "lucide-react"
import type { OperatorAdminMessages } from "../providers/operator-admin-messages.js"
import type { NavItem } from "../types.js"

export type OperatorAdminNavigationIconName =
  | "availability"
  | "bookings"
  | "catalog"
  | "channelSync"
  | "dashboard"
  | "finance"
  | "flights"
  | "legal"
  | "notifications"
  | "organizations"
  | "people"
  | "products"
  | "resources"
  | "settings"
  | "suppliers"

export type OperatorAdminNavigationIcons = Partial<
  Record<OperatorAdminNavigationIconName, NavItem["icon"]>
>

/**
 * The standard operator nav icon set, shipped by the framework so deployments
 * don't hand-wire lucide imports. Use directly (`icons={defaultOperatorNavIcons}`)
 * or spread to override a single entry
 * (`icons={{ ...defaultOperatorNavIcons, finance: MyIcon }}`). A custom domain
 * supplies its own icon via the override; the standard 15 come from here.
 */
export const defaultOperatorNavIcons: Record<OperatorAdminNavigationIconName, NavItem["icon"]> = {
  availability: CalendarDays,
  bookings: CalendarCheck,
  catalog: Library,
  channelSync: Radio,
  dashboard: LayoutDashboard,
  finance: DollarSign,
  flights: Plane,
  legal: Scale,
  notifications: Mail,
  organizations: Building,
  people: Users,
  products: Package,
  resources: Wrench,
  settings: Settings,
  suppliers: Building2,
}

export interface CreateOperatorAdminNavigationOptions {
  messages: OperatorAdminMessages["nav"]
  icons?: OperatorAdminNavigationIcons
}

export function createOperatorAdminNavigation({
  icons = {},
  messages,
}: CreateOperatorAdminNavigationOptions): NavItem[] {
  return [
    {
      id: "dashboard",
      title: messages.dashboard,
      url: "/",
      icon: icons.dashboard,
    },
    {
      id: "catalog",
      title: messages.catalog,
      url: "/catalog/products",
      icon: icons.catalog,
      items: [
        {
          id: "catalog-products",
          title: messages.catalogProducts,
          url: "/catalog/products",
        },
        {
          id: "catalog-excursions",
          title: messages.catalogExcursions,
          url: "/catalog/excursions",
        },
        {
          id: "catalog-tours",
          title: messages.catalogTours,
          url: "/catalog/tours",
        },
        {
          id: "catalog-cruises",
          title: messages.catalogCruises,
          url: "/catalog/cruises",
        },
        {
          id: "catalog-accommodations",
          title: messages.catalogAccommodations,
          url: "/catalog/accommodations",
        },
      ],
    },
    {
      id: "flights",
      title: messages.flights,
      url: "/flights",
      icon: icons.flights,
      items: [
        {
          id: "flights-search",
          title: messages.flightsSearch,
          url: "/flights",
        },
        {
          id: "flights-orders",
          title: messages.flightOrders,
          url: "/flights/orders",
        },
      ],
    },
    {
      id: "products",
      title: messages.products,
      url: "/products",
      icon: icons.products,
      items: [
        {
          id: "product-categories",
          title: messages.categories,
          url: "/products/categories",
        },
      ],
    },
    {
      id: "availability",
      title: messages.availability,
      url: "/operations/availability",
      icon: icons.availability,
    },
    {
      id: "bookings",
      title: messages.bookings,
      url: "/bookings",
      icon: icons.bookings,
    },
    {
      id: "notifications",
      title: messages.notifications,
      url: "/notifications/templates",
      icon: icons.notifications,
      items: [
        {
          id: "notification-templates",
          title: messages.notificationTemplates,
          url: "/notifications/templates",
        },
        {
          id: "notification-reminder-rules",
          title: messages.notificationReminderRules,
          url: "/notifications/reminder-rules",
        },
        {
          id: "notification-deliveries",
          title: messages.notificationDeliveries,
          url: "/notifications/deliveries",
        },
        {
          id: "notification-reminder-runs",
          title: messages.notificationReminderRuns,
          url: "/notifications/reminder-runs",
        },
        {
          id: "notification-preview",
          title: messages.notificationPreview,
          url: "/notifications/preview",
        },
        {
          id: "notification-settings",
          title: messages.notificationSettings,
          url: "/notifications/settings",
        },
      ],
    },
    {
      id: "suppliers",
      title: messages.suppliers,
      url: "/suppliers",
      icon: icons.suppliers,
    },
    {
      id: "people",
      title: messages.people,
      url: "/people",
      icon: icons.people,
    },
    {
      id: "organizations",
      title: messages.organizations,
      url: "/organizations",
      icon: icons.organizations,
    },
    {
      id: "resources",
      title: messages.resources,
      url: "/operations/resources",
      icon: icons.resources,
    },
    {
      id: "finance",
      title: messages.finance,
      url: "/finance/invoices",
      icon: icons.finance,
      items: [
        { id: "invoices", title: messages.invoices, url: "/finance/invoices" },
        {
          id: "invoice-number-series",
          title: messages.invoiceNumberSeries,
          url: "/finance/invoice-number-series",
        },
        { id: "payments", title: messages.payments, url: "/finance/payments" },
        {
          id: "supplier-invoices",
          title: messages.supplierInvoices,
          url: "/finance/supplier-invoices",
        },
        {
          id: "profitability",
          title: messages.profitability,
          url: "/finance/profitability",
        },
      ],
    },
    {
      id: "legal",
      title: messages.legal,
      url: "/legal/contracts",
      icon: icons.legal,
      items: [
        { id: "contracts", title: messages.contracts, url: "/legal/contracts" },
        {
          id: "contract-templates",
          title: messages.contractTemplates,
          url: "/legal/templates",
        },
        {
          id: "policies",
          title: messages.policies,
          url: "/legal/policies",
        },
        {
          id: "number-series",
          title: messages.contractNumberSeries,
          url: "/legal/number-series",
        },
      ],
    },
    {
      id: "channel-sync",
      title: messages.channelSync,
      url: "/channel-sync",
      icon: icons.channelSync,
    },
  ]
}
