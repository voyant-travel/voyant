import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

let runtimeHost: VoyantRuntimeHostPrimitives | undefined

export function configureCatalogStandardNodeHost(primitives: VoyantRuntimeHostPrimitives): void {
  runtimeHost = primitives
}

export function catalogStandardNodeHost(): VoyantRuntimeHostPrimitives {
  if (!runtimeHost) throw new Error("Catalog standard Node host is not configured")
  return runtimeHost
}
