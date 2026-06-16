/**
 * The standard Voyant runtime composition registry — the package-owned half of
 * `OPERATOR_RUNTIME_MANIFEST`'s factories.
 *
 * Workstream B of the consolidated-deployments RFC relocates the deployment's
 * `operatorComposition` registry here, one classified-as-standard family group
 * at a time (see `operator-registry-classification.md`). A deployment spreads
 * this into its own registry:
 *
 *     export const operatorComposition: CompositionRegistry<OperatorCapabilities> = {
 *       modules:    { ...frameworkComposition.modules,    ...deploymentLocal },
 *       extensions: { ...frameworkComposition.extensions, ...deploymentLocal },
 *     }
 *
 * so `composeFromManifest` always sees one complete registry while the
 * deployment object shrinks PR by PR.
 *
 * The factories read only the framework-owned {@link FrameworkProviders} surface
 * off `ctx.capabilities` — never a deployment file, never a baked provider
 * choice (Netopia et al. stay injected). Because `OperatorCapabilities extends
 * FrameworkProviders` and factory params are contravariant, a
 * `ModuleFactory<FrameworkProviders>` slots cleanly into the deployment's wider
 * `CompositionRegistry<OperatorCapabilities>`.
 */

import { actionLedgerHonoModule } from "@voyant-travel/action-ledger"
import { createCommerceHonoModules } from "@voyant-travel/commerce"
import {
  distributionHonoModule,
  externalRefsHonoModule,
  suppliersHonoModule,
} from "@voyant-travel/distribution"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import { identityHonoModule } from "@voyant-travel/identity"
import { inventoryHonoModule } from "@voyant-travel/inventory"
import { operationsHonoModule } from "@voyant-travel/operations"
import { createQuotesHonoModule } from "@voyant-travel/quotes"
import { createRelationshipsHonoModule } from "@voyant-travel/relationships"

/**
 * The injected, deployment-specific provider surface the framework's standard
 * factories read off the composition `ctx.capabilities`. It is the typed,
 * framework-owned subset of the deployment's capability container — the
 * deployment's `OperatorCapabilities extends FrameworkProviders`, so the
 * deployment supplies these (plus its own extras) and the framework factories
 * see only what they're entitled to.
 *
 * Empty today: Tier 1 relocates only the pure singleton module factories, which
 * take no providers. It grows as the capability-shaped factories
 * (catalog/bookings/finance/notifications/…) and the lazy `operator/*` route
 * loaders relocate in later tiers.
 */
// biome-ignore lint/suspicious/noEmptyInterface: intentional open supertype — empty until provider-needing factories relocate (Workstream B, see docs/architecture/consolidated-deployments-rfc.md). OperatorCapabilities must stay assignable to it, so it cannot narrow to Record<string, never>.
export interface FrameworkProviders {}

/**
 * Standard module/extension factories owned by the framework. Keyed by the same
 * manifest specifiers as `FRAMEWORK_RUNTIME_MANIFEST`; a deployment spreads this
 * into its registry (see file header).
 *
 * Tier 1: the pure singleton modules — no providers, no deployment imports.
 */
export const frameworkComposition: CompositionRegistry<FrameworkProviders> = {
  modules: {
    "@voyant-travel/action-ledger": () => actionLedgerHonoModule,
    "@voyant-travel/relationships": () => createRelationshipsHonoModule(),
    "@voyant-travel/quotes": () => createQuotesHonoModule(),
    "@voyant-travel/operations": () => operationsHonoModule,
    "@voyant-travel/identity": () => identityHonoModule,
    "@voyant-travel/distribution": () => [
      externalRefsHonoModule,
      distributionHonoModule,
      suppliersHonoModule,
    ],
    "@voyant-travel/commerce": () => createCommerceHonoModules(),
    "@voyant-travel/inventory": () => inventoryHonoModule,
  },
  extensions: {},
}
