import type { OperatorAdminMessages } from "@voyant-travel/admin/providers/operator-admin-messages"
import { Coins, FileText, Hash, KeyRound, Layers, Package, Percent, Tag, Tags } from "lucide-react"
import type * as React from "react"

/**
 * Catalog of the BUILT-IN settings pages the admin core extension ships
 * (packaged-admin RFC §4.2 — the operator's former
 * `src/routes/_workspace/settings/*` files). One entry drives both the
 * route contribution (id/path) and the settings layout's sub-navigation
 * (label/icon/group/order), so the two can never drift.
 */

export type AdminCoreSettingsPageId =
  | "api-tokens"
  | "channels"
  | "invoicing"
  | "taxes"
  | "cost-categories"
  | "pricing-categories"
  | "price-catalogs"
  | "product-types"
  | "product-tags"

export type AdminCoreSettingsNavGroup = "general" | "products"

/** Icon component contract — lucide icons satisfy it without depending on them. */
export type AdminCoreSettingsNavIcon = React.ComponentType<{ className?: string }>

export interface AdminCoreSettingsNavEntry {
  id: AdminCoreSettingsPageId
  /** Child path relative to the settings base path (starts with `/`). */
  path: string
  icon: AdminCoreSettingsNavIcon
  group: AdminCoreSettingsNavGroup
  /**
   * Position within the group. Built-ins use 20–80 (general) and 10–20
   * (products); app extras pick numbers around them (e.g. 10 to lead the
   * general group).
   */
  order: number
  /** Reactive nav label, resolved against the live operator admin messages. */
  label: (settings: OperatorAdminMessages["settings"]) => string
  /** Default (English) route title for the contribution. */
  defaultTitle: string
}

export const adminCoreSettingsNavEntries: ReadonlyArray<AdminCoreSettingsNavEntry> = [
  {
    id: "api-tokens",
    path: "/api-tokens",
    icon: KeyRound,
    group: "general",
    order: 30,
    label: (settings) => settings.apiTokens,
    defaultTitle: "API Tokens",
  },
  {
    id: "channels",
    path: "/channels",
    icon: Hash,
    group: "general",
    order: 40,
    label: (settings) => settings.channels,
    defaultTitle: "Channels",
  },
  {
    id: "invoicing",
    path: "/invoicing",
    icon: FileText,
    group: "general",
    order: 45,
    label: (settings) => settings.invoicing,
    defaultTitle: "Invoicing",
  },
  {
    id: "taxes",
    path: "/taxes",
    icon: Percent,
    group: "general",
    order: 50,
    label: (settings) => settings.taxes,
    defaultTitle: "Taxes",
  },
  {
    id: "cost-categories",
    path: "/cost-categories",
    icon: Coins,
    group: "general",
    order: 60,
    label: (settings) => settings.costCategories,
    defaultTitle: "Cost Categories",
  },
  {
    id: "pricing-categories",
    path: "/pricing-categories",
    icon: Tags,
    group: "general",
    order: 70,
    label: (settings) => settings.pricingCategories,
    defaultTitle: "Pricing Categories",
  },
  {
    id: "price-catalogs",
    path: "/price-catalogs",
    icon: Layers,
    group: "general",
    order: 80,
    label: (settings) => settings.priceCatalogs,
    defaultTitle: "Price Catalogs",
  },
  {
    id: "product-types",
    path: "/product-types",
    icon: Package,
    group: "products",
    order: 10,
    label: (settings) => settings.productTypes,
    defaultTitle: "Product Types",
  },
  {
    id: "product-tags",
    path: "/product-tags",
    icon: Tag,
    group: "products",
    order: 20,
    label: (settings) => settings.productTags,
    defaultTitle: "Product Tags",
  },
]

/** Extra (app-supplied) entry the settings layout splices into its nav. */
export interface AdminCoreSettingsExtraNavEntry {
  id: string
  href: string
  icon?: AdminCoreSettingsNavIcon
  group: AdminCoreSettingsNavGroup
  order: number
  label: string | ((messages: OperatorAdminMessages) => string)
}
