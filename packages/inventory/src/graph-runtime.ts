import { catalogContentRuntimePort } from "@voyant-travel/catalog/graph-runtime"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"

import { inventoryHonoModule } from "./interface.js"
import { createProductBrochureHonoExtension } from "./routes-brochure.js"
import { createProductContentHonoExtension } from "./routes-content.js"
import { inventoryBrochureRuntimePort, inventoryRuntimePort } from "./runtime-ports.js"

function selectedModuleSurfaces(
  configured: HonoModule,
  api: readonly { surface: string }[],
): HonoModule {
  return {
    ...configured,
    ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
    ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
  }
}

function selectedExtensionSurfaces(
  configured: HonoExtension,
  api: readonly { surface: string }[],
): HonoExtension {
  return {
    ...configured,
    ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
    ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
  }
}

export const createInventoryVoyantRuntime = defineGraphRuntimeFactory(async ({ api, getPort }) => {
  const runtime = await getPort(inventoryRuntimePort)
  return selectedModuleSurfaces(
    {
      ...inventoryHonoModule,
      module: { ...inventoryHonoModule.module, bootstrap: runtime.bootstrap },
    },
    api,
  )
})

export const createInventoryContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const runtime = await getPort(catalogContentRuntimePort)
    return selectedExtensionSurfaces(
      {
        ...createProductContentHonoExtension({
          admin: {
            resolveRegistry: runtime.resolveRegistry,
            defaultAcceptMachineTranslated: false,
          },
          public: {
            resolveRegistry: runtime.resolveRegistry,
            defaultAcceptMachineTranslated: true,
          },
        }),
        extension: { name: "inventory-content", module: "products" },
      },
      api,
    )
  },
)

export const createInventoryBrochureVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createProductBrochureHonoExtension(await getPort(inventoryBrochureRuntimePort)),
)

export type { InventoryRuntime } from "./runtime-ports.js"
export {
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "./runtime-ports.js"
