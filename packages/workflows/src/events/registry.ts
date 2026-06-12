// Process-local registry for event-filter runtime entries.
//
// `trigger.on(eventName, filter)` adds an entry here at module-load time.
// `createApp()` (PR4) walks `getEventFilterRegistry().list()` to build a
// manifest, hand it to the configured driver, and install the EventBus
// forwarder.
//
// Backed by `globalThis` so bundles that inline their own copy of
// `@voyantjs/workflows` still share the registry with the loader's copy
// — same pattern `getWorkflow()` uses for the workflow registry.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §12.

import type { EventFilterManifestEntry } from "../protocol/index.js"
import type { EventFilterDeclaration } from "../trigger.js"

const REGISTRY_KEY = "__voyantEventFilterRegistry" as const

/**
 * Internal/runtime form of a registered event filter. Carries:
 *   - The serializable manifest entry (sent to drivers, persisted in
 *     manifest stores, evaluated by the event router).
 *   - A debug-only structural copy of the original declaration. Not
 *     serialized; used by the dashboard / dev mode for human-readable
 *     filter inspection.
 *
 * Concrete `WorkflowDefinition` from `workflow.ts` satisfies the structural
 * `target` shape via TypeScript compat.
 */
export interface EventFilterRuntimeEntry {
  readonly id: string
  readonly eventType: string
  readonly manifest: EventFilterManifestEntry
  /** Debug-only — non-serializable. */
  readonly declaration: EventFilterDeclaration<unknown>
  /** Workflow id this filter targets, for quick lookup. */
  readonly targetWorkflowId: string
}

interface EventFilterRegistry {
  add(entry: EventFilterRuntimeEntry): void
  list(): EventFilterRuntimeEntry[]
  /** Reset to empty. Test-only — production code never calls this. */
  reset(): void
}

const globalRef = globalThis as typeof globalThis &
  Record<typeof REGISTRY_KEY, Map<string, EventFilterRuntimeEntry> | undefined>

const REGISTRY: Map<string, EventFilterRuntimeEntry> =
  globalRef[REGISTRY_KEY] ?? new Map<string, EventFilterRuntimeEntry>()
globalRef[REGISTRY_KEY] = REGISTRY

const registry: EventFilterRegistry = {
  add(entry) {
    if (REGISTRY.has(entry.id)) {
      // Same id implies same canonicalized declaration. HMR re-imports
      // and re-evaluations of the same module file land here; replace
      // (overwrite is harmless since the entry is content-addressed).
      // For genuine duplicates from different declarations, the canonical
      // hash would differ, so different ids would result.
      REGISTRY.set(entry.id, entry)
      return
    }
    REGISTRY.set(entry.id, entry)
  },
  list() {
    return [...REGISTRY.values()]
  },
  reset() {
    REGISTRY.clear()
  },
}

/** Process-local event-filter registry. Singleton per realm. */
export function getEventFilterRegistry(): EventFilterRegistry {
  return registry
}

/**
 * Internal: clear every registered filter. Used by tests that import the
 * SDK and need a clean slate between cases. Not part of the public API.
 */
export function __resetEventFilterRegistry(): void {
  registry.reset()
}
