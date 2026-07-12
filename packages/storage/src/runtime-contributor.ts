import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { createStorageRuntime } from "./runtime.js"
import { storageMediaRuntimePort } from "./runtime-port.js"

export interface StorageRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned Storage runtime registration map. */
export function createStorageRuntimePortContribution(
  host: StorageRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [storageMediaRuntimePort.id]: createStorageRuntime(host.primitives) }
}
