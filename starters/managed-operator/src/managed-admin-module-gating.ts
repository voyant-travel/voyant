import type { AdminExtension } from "@voyant-travel/admin/extensions"

/**
 * The module id each source-free admin extension needs mounted (voyant#3063).
 *
 * The managed admin is ONE shared, framework-version-tagged image; the active
 * module set is per-operator, injected at deploy. The image composes every
 * `create<Module>AdminExtension()` factory, then gates the NAV down to this
 * deployment's active modules at runtime (reported by `/auth/bootstrap-status`).
 * Without gating, every managed operator sees the full nav — with dead links to
 * pages whose API isn't mounted.
 *
 * An extension is ACTIVE only when its module is in the resolved module set.
 * `core` is intentionally absent — it is always active (dashboard, account, and
 * the built-in settings pages mount unconditionally). Every gated extension's
 * `id` currently equals its module id, but the map is explicit so a future
 * extension whose id diverges from its backing module is still gated correctly —
 * and so the coupling is documented in one place.
 *
 * Note `mice` maps to a `mice` module that is NOT part of the standard managed
 * manifest, so it is filtered out whenever the runtime reports its module set —
 * removing an extension whose API the managed runtime never mounts.
 */
export const MANAGED_ADMIN_EXTENSION_MODULE_IDS = {
  operations: "operations",
  bookings: "bookings",
  catalog: "catalog",
  inventory: "inventory",
  relationships: "relationships",
  distribution: "distribution",
  finance: "finance",
  flights: "flights",
  legal: "legal",
  notifications: "notifications",
  commerce: "commerce",
  trips: "trips",
  quotes: "quotes",
  mice: "mice",
  "action-ledger": "action-ledger",
} as const satisfies Record<string, string>

/**
 * Filter the full source-free admin registry down to the deployment's ACTIVE
 * modules (voyant#3063). Pass the module ids reported by
 * `/auth/bootstrap-status`.
 *
 * Fail-open: when `activeModuleIds` is `undefined` (an older runtime that does
 * not report its module set) every extension is kept — the admin behaves as it
 * did before gating rather than silently hiding pages. Extensions with no entry
 * in {@link MANAGED_ADMIN_EXTENSION_MODULE_IDS} (e.g. `core`) are always kept.
 */
export function filterManagedAdminExtensionsByModules(
  extensions: ReadonlyArray<AdminExtension>,
  activeModuleIds: readonly string[] | undefined,
): AdminExtension[] {
  if (!activeModuleIds) return [...extensions]
  const active = new Set(activeModuleIds)
  return extensions.filter((extension) => {
    const requiredModuleId =
      MANAGED_ADMIN_EXTENSION_MODULE_IDS[
        extension.id as keyof typeof MANAGED_ADMIN_EXTENSION_MODULE_IDS
      ]
    return requiredModuleId === undefined || active.has(requiredModuleId)
  })
}
