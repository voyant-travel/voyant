import type { HonoBundle } from "@voyant-travel/hono/plugin"

export const catalogBridgeBundle: HonoBundle = {
  name: "catalog-bridge",
  bootstrap: async (ctx) => {
    const { catalogBridgeBundle } = await import("./catalog-bridge")
    await catalogBridgeBundle.bootstrap?.(ctx)
  },
}
