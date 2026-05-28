/**
 * Process-local registry of cruise adapters.
 *
 * Templates register adapters at app startup:
 *
 *   import { registerCruiseAdapter } from "@voyantjs/cruises/adapters"
 *   import { createCruiseAdapter } from "external-cruise-adapter"
 *
 *   registerCruiseAdapter(createCruiseAdapter({ token: env.CRUISE_ADAPTER_TOKEN }))
 *
 * The route layer resolves an adapter by `sourceProvider` (the prefix in the
 * unified key `<provider>:<ref>`) before dispatching detail reads, refresh,
 * detach, or the external booking commit.
 *
 * The registry is intentionally a plain Map. There's no per-tenant scoping —
 * each Voyant deployment is single-tenant. Tests can reset state via
 * `clearCruiseAdapters()`.
 */

import type { CruiseAdapter } from "./index.js"

const adapters = new Map<string, CruiseAdapter>()

export function registerCruiseAdapter(adapter: CruiseAdapter): void {
  if (!adapter.name) throw new Error("Adapter must have a non-empty name")
  if (adapters.has(adapter.name)) {
    throw new Error(
      `Cruise adapter '${adapter.name}' is already registered; call unregisterCruiseAdapter first if you intend to replace it`,
    )
  }
  adapters.set(adapter.name, adapter)
}

export function unregisterCruiseAdapter(name: string): boolean {
  return adapters.delete(name)
}

export function clearCruiseAdapters(): void {
  adapters.clear()
}

export function resolveCruiseAdapter(name: string): CruiseAdapter | undefined {
  return adapters.get(name)
}

export function listCruiseAdapters(): CruiseAdapter[] {
  return Array.from(adapters.values())
}

export function hasCruiseAdapter(name: string): boolean {
  return adapters.has(name)
}
