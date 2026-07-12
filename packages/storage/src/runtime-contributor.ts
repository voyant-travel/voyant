import type { MediaRoutesOptions } from "./routes.js"
import { storageMediaRuntimePort } from "./runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface StorageRuntimePortContribution {
  media: RuntimePortValue<MediaRoutesOptions>
}

/** Package-owned registration map for Storage deployment adapters. */
export function createStorageRuntimePortContribution(
  contribution: StorageRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [storageMediaRuntimePort.id]: contribution.media }
}
