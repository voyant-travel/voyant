import type {
  DefineVoyantGraphProjectUnitInput,
  VoyantGraphProjectAccessDeclaration,
  VoyantGraphProjectDeployment,
  VoyantProductBomReference,
} from "@voyant-travel/core/project"

export const STANDARD_OPERATOR_PRODUCT_BOM_REFERENCE = {
  schemaVersion: "voyant.product-bom-reference.v1",
  id: "@voyant-travel/operator-standard",
  version: "1",
} as const satisfies VoyantProductBomReference

export const STANDARD_OPERATOR_ACCESS: VoyantGraphProjectAccessDeclaration = {
  presets: [
    {
      id: "commerce-read",
      kind: "api-token",
      label: "Commerce read",
      grants: ["bookings:read"],
    },
    {
      id: "agent-staff",
      kind: "api-token-grant",
      label: "Agent (staff)",
      grants: ["bookings:read", "bookings:write"],
      audience: "staff",
    },
    {
      id: "editor",
      kind: "staff",
      label: "Editor",
      grants: ["bookings:read", "bookings:write"],
    },
  ],
}

export const STANDARD_OPERATOR_DEPLOYMENT: VoyantGraphProjectDeployment = {
  target: "node",
  mode: "self-hosted",
  providers: {
    database: "postgres",
    storage: "memory",
    cache: "postgres",
    sharedState: "memory",
    rateLimit: "memory",
    search: "none",
    email: "none",
    sms: "none",
    auth: "better-auth",
    scheduledJobs: "none",
    workflows: "none",
  },
  migrations: [{ id: "deployment", source: "./migrations" }],
}

export interface OperatorDistributionDeclaration {
  id: string
  target: "node"
  modules: readonly DefineVoyantGraphProjectUnitInput[]
  extensions: readonly DefineVoyantGraphProjectUnitInput[]
}

/** Consumer-owned differences applied after the framework distribution. */
export interface OperatorDistributionDifferences {
  modules?: readonly DefineVoyantGraphProjectUnitInput[]
  extensions?: readonly DefineVoyantGraphProjectUnitInput[]
  plugins?: readonly DefineVoyantGraphProjectUnitInput[]
}

/** Resolver input after framework defaults and consumer differences are merged. */
export interface ResolvedOperatorDistribution {
  modules: readonly DefineVoyantGraphProjectUnitInput[]
  extensions: readonly DefineVoyantGraphProjectUnitInput[]
  plugins: readonly DefineVoyantGraphProjectUnitInput[]
}

interface StandardModuleSelection {
  resolve: string
  /** Kept only while createVoyantApp consumes the legacy composition registry. */
  legacyRuntime?: true
  required?: true
}

interface StandardExtensionSelection {
  resolve: string
  /** Module selections whose removal also removes this extension. */
  owners: readonly string[]
  /** Kept only while createVoyantApp consumes the legacy composition registry. */
  legacyRuntime?: true
  /** Historical registry key when it differs from the canonical graph selection. */
  legacyRuntimeResolve?: string
}

export interface SelectStandardOperatorDistributionOptions {
  exclude?: readonly string[]
  /** Restrict the projection to the createVoyantApp compatibility registry. */
  legacyRuntimeOnly?: boolean
}

/**
 * Selection policy for the standard Operator distribution. Package facets are
 * not declared here: every selected unit is loaded from its owning package's
 * `./voyant` export after admission. This declaration owns only product closure,
 * required selections, stable order, and removal cascade policy.
 */
export const STANDARD_OPERATOR_DISTRIBUTION_POLICY: {
  readonly id: "operator-standard"
  readonly target: "node"
  readonly modules: readonly StandardModuleSelection[]
  readonly extensions: readonly StandardExtensionSelection[]
} = {
  id: "operator-standard",
  target: "node",
  modules: [
    { resolve: "@voyant-travel/action-ledger", legacyRuntime: true, required: true },
    { resolve: "@voyant-travel/relationships", legacyRuntime: true, required: true },
    { resolve: "@voyant-travel/quotes", legacyRuntime: true },
    { resolve: "@voyant-travel/operations", legacyRuntime: true },
    { resolve: "@voyant-travel/identity", legacyRuntime: true, required: true },
    { resolve: "@voyant-travel/distribution", legacyRuntime: true },
    { resolve: "@voyant-travel/inventory/extras", legacyRuntime: true },
    { resolve: "@voyant-travel/bookings/requirements", legacyRuntime: true },
    { resolve: "@voyant-travel/commerce", legacyRuntime: true, required: true },
    { resolve: "@voyant-travel/inventory", legacyRuntime: true },
    { resolve: "@voyant-travel/catalog", legacyRuntime: true },
    { resolve: "@voyant-travel/catalog/booking-engine", legacyRuntime: true },
    { resolve: "@voyant-travel/accommodations", legacyRuntime: true },
    { resolve: "@voyant-travel/bookings", legacyRuntime: true },
    { resolve: "@voyant-travel/finance", legacyRuntime: true },
    { resolve: "@voyant-travel/legal", legacyRuntime: true },
    { resolve: "@voyant-travel/legal/contract-document", legacyRuntime: true },
    { resolve: "@voyant-travel/public-document-delivery", legacyRuntime: true },
    { resolve: "@voyant-travel/notifications", legacyRuntime: true },
    { resolve: "@voyant-travel/storage", legacyRuntime: true },
    { resolve: "@voyant-travel/storefront", legacyRuntime: true },
    { resolve: "@voyant-travel/storefront/customer-portal", legacyRuntime: true },
    { resolve: "@voyant-travel/storefront/verification", legacyRuntime: true },
    { resolve: "@voyant-travel/storefront/payment-link", legacyRuntime: true },
    { resolve: "@voyant-travel/trips", legacyRuntime: true },
    { resolve: "@voyant-travel/flights", legacyRuntime: true },
    { resolve: "@voyant-travel/operator-settings", legacyRuntime: true },
    { resolve: "@voyant-travel/charters" },
    { resolve: "@voyant-travel/cruises" },
    { resolve: "@voyant-travel/realtime" },
    { resolve: "@voyant-travel/mice" },
    { resolve: "@voyant-travel/db" },
    { resolve: "@voyant-travel/availability" },
    { resolve: "@voyant-travel/catalog-authoring" },
    { resolve: "@voyant-travel/workflow-runs" },
  ],
  extensions: [
    {
      resolve: "@voyant-travel/bookings/booking-supplier-extension",
      owners: ["@voyant-travel/bookings"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/finance/bookings-create-extension",
      owners: ["@voyant-travel/finance", "@voyant-travel/bookings"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/inventory/booking-extension",
      owners: ["@voyant-travel/inventory", "@voyant-travel/bookings"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/inventory/authoring/extension",
      owners: ["@voyant-travel/inventory"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/quotes/booking-extension",
      owners: ["@voyant-travel/quotes", "@voyant-travel/bookings"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/distribution/extension",
      owners: ["@voyant-travel/distribution", "@voyant-travel/bookings"],
      legacyRuntime: true,
      legacyRuntimeResolve: "@voyant-travel/distribution",
    },
    {
      resolve: "@voyant-travel/distribution/channel-push-extension",
      owners: ["@voyant-travel/distribution"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/finance/booking-tax-extension",
      owners: [
        "@voyant-travel/finance",
        "@voyant-travel/bookings",
        "@voyant-travel/operator-settings",
      ],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/inventory/content-extension",
      owners: ["@voyant-travel/inventory"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/cruises/content-extension",
      owners: ["@voyant-travel/catalog"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/accommodations/content-extension",
      owners: ["@voyant-travel/accommodations"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/inventory/brochure-extension",
      owners: ["@voyant-travel/inventory", "@voyant-travel/storage"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/finance/booking-schedule-extension",
      owners: [
        "@voyant-travel/finance",
        "@voyant-travel/bookings",
        "@voyant-travel/operator-settings",
      ],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/quotes/quote-version-snapshot-extension",
      owners: ["@voyant-travel/quotes", "@voyant-travel/trips"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/commerce/booking-maintenance-extension",
      owners: [
        "@voyant-travel/bookings",
        "@voyant-travel/commerce",
        "@voyant-travel/operator-settings",
      ],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/action-ledger/health-extension",
      owners: ["@voyant-travel/action-ledger"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/quotes/proposal-extension",
      owners: ["@voyant-travel/quotes"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/catalog/offers-extension",
      owners: ["@voyant-travel/catalog"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/commerce/catalog-checkout-extension",
      owners: ["@voyant-travel/catalog", "@voyant-travel/commerce"],
      legacyRuntime: true,
    },
    {
      resolve: "@voyant-travel/mice/booking-extension",
      owners: ["@voyant-travel/mice", "@voyant-travel/bookings"],
    },
    {
      resolve: "@voyant-travel/notifications/reminder-subscribers-extension",
      owners: ["@voyant-travel/notifications"],
    },
    {
      resolve: "@voyant-travel/legal/booking-contract-extension",
      owners: ["@voyant-travel/legal"],
    },
  ],
}

/** Versioned standard product declaration expanded by defineConfig at build time. */
export const STANDARD_OPERATOR_PRODUCT_BOM = {
  ...STANDARD_OPERATOR_PRODUCT_BOM_REFERENCE,
  target: STANDARD_OPERATOR_DISTRIBUTION_POLICY.target,
  modules: STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules.map(({ resolve }) => resolve),
  extensions: STANDARD_OPERATOR_DISTRIBUTION_POLICY.extensions.map(({ resolve }) => resolve),
  access: STANDARD_OPERATOR_ACCESS,
  deployment: STANDARD_OPERATOR_DEPLOYMENT,
}

/** The package selectors used to load the standard Node Operator graph. */
export const STANDARD_OPERATOR_DISTRIBUTION = {
  id: STANDARD_OPERATOR_DISTRIBUTION_POLICY.id,
  target: STANDARD_OPERATOR_PRODUCT_BOM.target,
  modules: STANDARD_OPERATOR_PRODUCT_BOM.modules,
  extensions: STANDARD_OPERATOR_PRODUCT_BOM.extensions,
} satisfies OperatorDistributionDeclaration

/** Compatibility projection for the old createVoyantApp composition registry. */
export const STANDARD_OPERATOR_LEGACY_RUNTIME_MANIFEST = {
  modules: STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules
    .filter((selection) => selection.legacyRuntime)
    .map(({ resolve }) => resolve),
  extensions: STANDARD_OPERATOR_DISTRIBUTION_POLICY.extensions
    .filter((selection) => selection.legacyRuntime)
    .map((selection) => selection.legacyRuntimeResolve ?? selection.resolve),
}

/** Compatibility projection for legacy required-module validation. */
export const STANDARD_OPERATOR_REQUIRED_MODULES = STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules
  .filter((selection) => selection.required)
  .map(({ resolve }) => resolve)

/** Compatibility projection for legacy extension-removal behavior. */
export const STANDARD_OPERATOR_LEGACY_EXTENSION_OWNERSHIP = Object.fromEntries(
  STANDARD_OPERATOR_DISTRIBUTION_POLICY.extensions
    .filter((selection) => selection.legacyRuntime)
    .map((selection) => [selection.legacyRuntimeResolve ?? selection.resolve, selection.owners]),
) as Readonly<Record<string, readonly string[]>>

/** Resolve package selectors after applying product-removal policy. */
export function selectStandardOperatorDistribution({
  exclude = [],
  legacyRuntimeOnly = false,
}: SelectStandardOperatorDistributionOptions = {}): {
  modules: string[]
  extensions: string[]
} {
  const moduleSelections = STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules.filter(
    (selection) => !legacyRuntimeOnly || selection.legacyRuntime,
  )
  const extensionSelections = STANDARD_OPERATOR_DISTRIBUTION_POLICY.extensions.filter(
    (selection) => !legacyRuntimeOnly || selection.legacyRuntime,
  )
  const moduleResolve = (selection: (typeof moduleSelections)[number]) => selection.resolve
  const extensionResolve = (selection: (typeof extensionSelections)[number]) =>
    legacyRuntimeOnly ? (selection.legacyRuntimeResolve ?? selection.resolve) : selection.resolve
  const known = new Set([
    ...moduleSelections.map(moduleResolve),
    ...extensionSelections.map(extensionResolve),
  ])
  const excludeSet = new Set(exclude)
  const unknown = [...excludeSet].filter((specifier) => !known.has(specifier)).sort()
  if (unknown.length > 0) {
    throw new Error(
      `exclude names ${unknown.length} selection(s) not in the standard set: ${unknown.join(", ")}.`,
    )
  }

  const required = moduleSelections
    .filter((selection) => selection.required && excludeSet.has(selection.resolve))
    .map(({ resolve }) => resolve)
  if (required.length > 0) {
    throw new Error(`cannot exclude required module(s): ${required.join(", ")}.`)
  }

  for (const selection of extensionSelections) {
    if (selection.owners.some((owner) => excludeSet.has(owner))) {
      excludeSet.add(extensionResolve(selection))
    }
  }

  return {
    modules: moduleSelections.map(moduleResolve).filter((resolve) => !excludeSet.has(resolve)),
    extensions: extensionSelections
      .map(extensionResolve)
      .filter((resolve) => !excludeSet.has(resolve)),
  }
}

/**
 * Applies the standard Operator product closure before consumer-owned
 * differences. Authored config describes differences and does not repeat the
 * standard declaration.
 */
export function mergeOperatorDistributionDefaults(
  differences: OperatorDistributionDifferences = {},
  distribution: OperatorDistributionDeclaration = STANDARD_OPERATOR_DISTRIBUTION,
): ResolvedOperatorDistribution {
  return {
    modules: [...distribution.modules, ...(differences.modules ?? [])],
    extensions: [...distribution.extensions, ...(differences.extensions ?? [])],
    plugins: [...(differences.plugins ?? [])],
  }
}
