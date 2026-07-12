import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { storageMediaRuntimePort } from "./runtime-port.js"

export interface StorageRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned registration map for Storage deployment adapters. */
export function createStorageRuntimePortContribution(
  host: StorageRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) =>
    module.createStorageStandardNodeRuntime(host.primitives),
  )
  return { [storageMediaRuntimePort.id]: runtime }
}
