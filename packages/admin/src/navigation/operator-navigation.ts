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
      url: "/catalog",
      icon: icons.catalog,
    },
    {
      id: "flights",
      title: messages.flights,
      url: "/flights",
      icon: icons.flights,
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
      url: "/availability",
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
      url: "/resources",
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
