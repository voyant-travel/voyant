/**
 * Workflow-entry-safe channel-push surface.
 *
 * This subpath is intentionally narrower than `@voyant-travel/distribution`:
 * workflow bundles import it at module evaluation time, so it must not pull in
 * routes, Hono extensions, or app-server wiring. Import this subpath only when
 * a bundle opts into channel-push workflow registration.
 */

export {
  CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY,
  type ChannelPushReconcileWorkflowRuntime,
  channelPushAvailabilityReconcileWorkflow,
  channelPushBookingLinkReconcileWorkflow,
  channelPushContentReconcileWorkflow,
} from "./reconcile-workflows.js"
export {
  CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY,
  type ChannelPushDeps,
  type ChannelPushLogger,
  clearChannelPushDeps,
  defaultLogger,
  getChannelPushDeps,
  getChannelPushDepsOrThrow,
  setChannelPushDeps,
} from "./types.js"
export {
  channelAvailabilityPushWorkflow,
  channelBookingPushWorkflow,
  channelContentPushWorkflow,
} from "./workflows.js"

import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY,
  type ChannelPushReconcileWorkflowRuntime,
} from "./reconcile-workflows.js"
import { CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, type ChannelPushDeps } from "./types.js"

export interface ChannelPushWorkflowRuntimeHost {
  resolveDb: () => AnyDrizzleDb
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  resolveRegistry: () => SourceAdapterRegistry | Promise<SourceAdapterRegistry>
}

/** Package-owned workflow registrations with deployment resources injected. */
export async function createChannelPushWorkflowRuntimeEntries(
  host: ChannelPushWorkflowRuntimeHost,
): Promise<
  ReadonlyArray<readonly [string, ChannelPushDeps | ChannelPushReconcileWorkflowRuntime]>
> {
  const runtime: ChannelPushDeps = {
    db: createLazyRuntimeResource(host.resolveDb),
    registry: await host.resolveRegistry(),
  }
  const reconcileRuntime: ChannelPushReconcileWorkflowRuntime = {
    withDeps: (operation) =>
      host.withDb(async (db) => operation({ db, registry: await host.resolveRegistry() })),
  }
  return [
    [CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, runtime],
    [CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY, reconcileRuntime],
  ]
}

function createLazyRuntimeResource<T extends object>(factory: () => T): T {
  let resource: T | undefined
  const resolve = () => (resource ??= factory())
  return new Proxy({} as T, {
    get(_target, prop) {
      const value = Reflect.get(resolve(), prop, resolve())
      return typeof value === "function" ? value.bind(resolve()) : value
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolve(), prop)
    },
    has(_target, prop) {
      return prop in resolve()
    },
    ownKeys() {
      return Reflect.ownKeys(resolve())
    },
  })
}
