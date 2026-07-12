import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CatalogRuntimeExtensions } from "../runtime-contracts.js"

let runtimeHost: VoyantRuntimeHostPrimitives | undefined
let runtimeExtensions: CatalogRuntimeExtensions | undefined

export function configureCatalogRuntimeHost(
  primitives: VoyantRuntimeHostPrimitives,
  extensions: CatalogRuntimeExtensions,
): void {
  runtimeHost = primitives
  runtimeExtensions = extensions
}

export function catalogRuntimeHost(): VoyantRuntimeHostPrimitives {
  if (!runtimeHost) throw new Error("Catalog runtime host is not configured")
  return runtimeHost
}

export function catalogRuntimeExtensions(): CatalogRuntimeExtensions {
  if (!runtimeExtensions) throw new Error("Catalog runtime extensions are not configured")
  return runtimeExtensions
}
