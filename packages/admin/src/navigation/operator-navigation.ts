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

/**
 * The module id each standard nav item needs mounted (voyant#3063). Used to gate
 * the base nav for a deployment that activates only a module subset — a
 * source-free managed admin composes the full nav from one shared image and
 * filters it at runtime by the active module set, so items whose API isn't
 * mounted don't render as dead links.
 *
 * Keyed by the `id`s in {@link createOperatorAdminNavigation}. Items with no
 * entry here (e.g. `dashboard`, `settings`) are always shown. Note the mapping
 * is not always identity: `products` → `inventory`, `availability`/`resources` →
 * `operations`, `people`/`organizations` → `relationships`, `suppliers` and
 * `channel-sync` → `distribution`.
 */
export const OPERATOR_ADMIN_NAV_MODULE_IDS: Record<string, string> = {
  catalog: "catalog",
  flights: "flights",
  products: "inventory",
  availability: "operations",
  bookings: "bookings",
  notifications: "notifications",
  suppliers: "distribution",
  people: "relationships",
  organizations: "relationships",
  resources: "operations",
  finance: "finance",
  legal: "legal",
  "channel-sync": "distribution",
}

/**
 * Filter a nav list down to a deployment's active modules (voyant#3063), keyed
 * by {@link OPERATOR_ADMIN_NAV_MODULE_IDS}. Fail-open: when `activeModuleIds` is
 * `undefined` (a host that does not gate — e.g. a self-hosted starter built from
 * its own module set) every item is kept. Items with no module mapping are
 * always kept; a mapped item survives only when its module is active.
 */
export function filterAdminNavigationByModules(
  items: ReadonlyArray<NavItem>,
  activeModuleIds: readonly string[] | undefined,
): NavItem[] {
  if (!activeModuleIds) return [...items]
  const active = new Set(activeModuleIds)
  return items.filter((item) => {
    const moduleId = item.id ? OPERATOR_ADMIN_NAV_MODULE_IDS[item.id] : undefined
    return moduleId === undefined || active.has(moduleId)
  })
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
