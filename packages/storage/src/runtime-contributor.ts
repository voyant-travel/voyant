import type { MediaRoutesOptions } from "./routes.js"
import { storageMediaRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface StorageRuntimeContributorHost {
  capabilities: {
    loadStorageMediaRuntime(): RuntimePortValue<MediaRoutesOptions>
  }
}

/** Package-owned registration map for Storage deployment adapters. */
export function createStorageRuntimePortContribution(
  host: StorageRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return { [storageMediaRuntimePort.id]: host.capabilities.loadStorageMediaRuntime() }
}
