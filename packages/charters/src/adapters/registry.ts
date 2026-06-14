/**
 * Process-local registry of charter adapters.
 *
 * Templates register adapters at app startup:
 *
 *   import { createConnectCharterAdapter } from "@voyant-travel/charters-adapter-connect"
 *   registerCharterAdapter(createConnectCharterAdapter({ apiKey: env.VOYANT_CONNECT_API_KEY }))
 *
 * The route layer resolves an adapter by `sourceProvider` (the prefix in the
 * unified key `<provider>:<ref>`) before dispatching detail reads or external
 * booking commits.
 *
 * The registry is intentionally a plain Map. There's no per-tenant scoping —
 * each Voyant deployment is single-tenant. Tests reset state via
 * `clearCharterAdapters()`.
 */

import type { CharterAdapter } from "./index.js"

const adapters = new Map<string, CharterAdapter>()

export function registerCharterAdapter(adapter: CharterAdapter): void {
  if (!adapter.name) throw new Error("Adapter must have a non-empty name")
  if (adapters.has(adapter.name)) {
    throw new Error(
      `Charter adapter '${adapter.name}' is already registered; call unregisterCharterAdapter first if you intend to replace it`,
    )
  }
  adapters.set(adapter.name, adapter)
}

export function unregisterCharterAdapter(name: string): boolean {
  return adapters.delete(name)
}

export function clearCharterAdapters(): void {
  adapters.clear()
}

export function resolveCharterAdapter(name: string): CharterAdapter | undefined {
  return adapters.get(name)
}

export function listCharterAdapters(): CharterAdapter[] {
  return Array.from(adapters.values())
}

export function hasCharterAdapter(name: string): boolean {
  return adapters.has(name)
}
