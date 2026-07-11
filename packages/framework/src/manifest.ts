/**
 * Compatibility views for the old createVoyantApp composition registry.
 *
 * Standard product selection policy lives in `operator-distribution.ts` and
 * package behavior lives in each selected package's `./voyant` manifest. The
 * exports in this file remain public while legacy runtime composition migrates.
 *
 * The standard set is the DEFAULT, not a fixed profile (ADR-0007). A deployment
 * may pare it down via `createVoyantApp({ exclude })` (remove), validated against
 * `FRAMEWORK_CAPABILITY_GRAPH` (below) so dropping a depended-on module, or an
 * `isRequired` one, fails at boot rather than as a runtime 500. Excluding a module
 * cascades to the extensions it owns (`FRAMEWORK_EXTENSION_OWNERSHIP`, voyant#2104).
 * The subset gates runtime + admin surfaces only; the migration bundle stays
 * monolithic, so an excluded module's tables are created but inert. Capability
 * *replacement* (override a module with a substitute) is the v2 design — see
 * ADR-0007 "Deferred to v2".
 *
 * Do not add first-party package ids here. The architecture checker enforces
 * that these exports remain projections rather than a second product catalog.
 */
import { type CapabilityGraph, findCapabilityGaps } from "@voyant-travel/hono/composition"
import {
  STANDARD_OPERATOR_LEGACY_EXTENSION_OWNERSHIP,
  STANDARD_OPERATOR_LEGACY_RUNTIME_MANIFEST,
  STANDARD_OPERATOR_REQUIRED_MODULES,
  selectStandardOperatorDistribution,
} from "./operator-distribution.js"

export interface FrameworkManifest {
  modules: readonly string[]
  extensions: readonly string[]
}

export const FRAMEWORK_RUNTIME_MANIFEST =
  STANDARD_OPERATOR_LEGACY_RUNTIME_MANIFEST satisfies FrameworkManifest

export const FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS = [] as const

export const FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIER_SET = new Set<string>(
  FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS,
)

/**
 * The standard set's capability dependency graph (ADR-0007). `isRequired` marks
 * foundational modules a deployment may not `exclude`; `createVoyantApp` throws a
 * named boot error if one is excluded. The `provides`/`requires` edges (for
 * non-required modules a deployment *could* drop) are validated the same way —
 * excluding a depended-on module names the orphaned consumers — but the v1
 * standard set declares no such edges: every cross-cutting module is simply
 * required.
 *
 * The required set is kept intentionally minimal — cross-cutting infrastructure
 * (audit ledger, identity/contact-points, commerce primitives) plus CRM. CRM
 * (`relationships`) is required rather than pluggable: deployments extend it with
 * custom fields (`customFieldDefinitions`), not by swapping it out. A pluggable
 * CRM port was considered and rejected as over-engineering for v1 (ADR-0007
 * "Alternatives"). Everything else (flights, trips, cruises, …) stays excludable.
 */
export const FRAMEWORK_CAPABILITY_GRAPH = Object.fromEntries(
  STANDARD_OPERATOR_REQUIRED_MODULES.map((specifier) => [specifier, { isRequired: true }]),
) satisfies CapabilityGraph

/**
 * Which standard module(s) each standard extension augments (voyant#2104,
 * ADR-0007 follow-up a). An extension's mount prefix is a *path*, not a foreign
 * key to a module `name` — the standard set legitimately ships path-mounted
 * extensions with no same-named module (e.g. `@voyant-travel/quotes/proposal-extension`
 * mounts under `quote-versions`), so a name-match orphan check is unsound.
 * Ownership is therefore declared by standard distribution selection policy,
 * so excluding a module can cascade to its extensions safely
 * (see `ownedExtensionsForExcludedModules` / `subsetStandardManifest`).
 *
 * An extension is owned by every listed module: excluding *any* owner drops it,
 * because the extension augments a surface that owner contributes.
 */
export const FRAMEWORK_EXTENSION_OWNERSHIP = STANDARD_OPERATOR_LEGACY_EXTENSION_OWNERSHIP

/** Options for {@link subsetStandardManifest}. */
export interface SubsetOptions {
  /** Specifiers to remove entirely (rejected if unknown, `isRequired`, or depended-on). */
  exclude?: readonly string[]
}

/**
 * The standard extensions owned by any of the excluded specifiers — an extension
 * whose declared owner module (see `FRAMEWORK_EXTENSION_OWNERSHIP`) is being
 * removed. Excluding a module must cascade to these, or the removed surface
 * partially leaks: e.g. dropping `bookings` while `finance/bookings-create-extension`
 * (mounting under `/v1/admin/bookings`) stays mounted (voyant#2104). Ownership is
 * declared, not name-matched, so path-mounted extensions cascade correctly.
 */
export function ownedExtensionsForExcludedModules(excluded: Iterable<string>): string[] {
  const excludedSet = excluded instanceof Set ? excluded : new Set(excluded)
  const owned: string[] = []
  for (const extension of FRAMEWORK_RUNTIME_MANIFEST.extensions) {
    const owners = FRAMEWORK_EXTENSION_OWNERSHIP[extension] ?? []
    if (owners.some((owner) => excludedSet.has(owner))) owned.push(extension)
  }
  return owned
}

/**
 * Apply `exclude` to the standard set (ADR-0007), returning the module/extension
 * specifiers that should mount. Pure and provider-free (manifest math only, no
 * runtime composition), so it is unit-testable, reusable by tooling (`db doctor`),
 * and safe to import from the lightweight `@voyant-travel/framework/profile`
 * subpath. Throws — fail-loud at boot, never a runtime 500 — when `exclude` names
 * a specifier absent from the standard set (a typo), names an `isRequired` module,
 * or leaves a still-mounted module's `requires` unmet (drop the consumers too).
 */
export function subsetStandardManifest({ exclude = [] }: SubsetOptions = {}): {
  modules: string[]
  extensions: string[]
} {
  let selected: { modules: string[]; extensions: string[] }
  try {
    selected = selectStandardOperatorDistribution({ exclude, legacyRuntimeOnly: true })
  } catch (error) {
    throw new Error(
      `createVoyantApp: ${error instanceof Error ? error.message : "invalid standard selection"}`,
    )
  }
  const { modules, extensions } = selected

  // The capability graph is validated over what actually mounts: dropping a
  // module a still-mounted module depends on — without also dropping the consumer
  // — fails loudly here rather than as a runtime 500.
  const gaps = findCapabilityGaps(modules, FRAMEWORK_CAPABILITY_GRAPH)
  if (gaps.length > 0) {
    const detail = gaps
      .map((g) => `"${g.capability}" (required by ${g.requiredBy.join(", ")})`)
      .join("; ")
    throw new Error(
      `createVoyantApp: exclude leaves unmet capabilities: ${detail}. ` +
        "Exclude the consumers too (capability replacement is a future release).",
    )
  }

  return { modules, extensions }
}
