import { catalogContentRuntimePort } from "@voyant-travel/catalog/runtime-port"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import { storageMediaRuntimePort } from "@voyant-travel/storage/runtime-port"

import { inventoryExtrasHonoModule } from "./extras.js"
import { inventoryHonoModule } from "./interface.js"
import { createProductBrochureHonoExtension } from "./routes-brochure.js"
import { createProductContentHonoExtension } from "./routes-content.js"
import { inventoryBrochureRuntimePort, inventoryRuntimePort } from "./runtime-ports.js"

function selectedModuleSurfaces(
  configured: HonoModule,
  api: readonly { id: string; surface: string }[],
): HonoModule {
  const adminApiId = api.find(({ surface }) => surface === "admin")?.id
  const publicApiId = api.find(({ surface }) => surface === "public")?.id
  return {
    ...configured,
    ...(adminApiId
      ? { adminRoutes: stampOpenApiRegistryApiId(configured.adminRoutes, adminApiId) }
      : { adminRoutes: undefined }),
    ...(publicApiId
      ? { publicRoutes: stampOpenApiRegistryApiId(configured.publicRoutes, publicApiId) }
      : { publicRoutes: undefined }),
  }
}

function selectedExtensionSurfaces(
  configured: HonoExtension,
  api: readonly { id: string; surface: string }[],
): HonoExtension {
  const adminApiId = api.find(({ surface }) => surface === "admin")?.id
  const publicApiId = api.find(({ surface }) => surface === "public")?.id
  return {
    ...configured,
    ...(adminApiId
      ? { adminRoutes: stampOpenApiRegistryApiId(configured.adminRoutes, adminApiId) }
      : { adminRoutes: undefined }),
    ...(publicApiId
      ? { publicRoutes: stampOpenApiRegistryApiId(configured.publicRoutes, publicApiId) }
      : { publicRoutes: undefined }),
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

export const createInventoryExtrasVoyantRuntime = defineGraphRuntimeFactory(async ({ api }) =>
  selectedModuleSurfaces(inventoryExtrasHonoModule, api),
)

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

export const createInventoryBrochureVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const [brochure, storage] = await Promise.all([
      getPort(inventoryBrochureRuntimePort),
      getPort(storageMediaRuntimePort),
    ])
    return selectedExtensionSurfaces(
      createProductBrochureHonoExtension({
        ...brochure,
        resolveStorage: storage.resolveStorage,
      }),
      api,
    )
  },
)

export type { InventoryRuntime } from "./runtime-ports.js"
export {
  inventoryBrochureRuntimePort,
  inventoryRuntimePort,
} from "./runtime-ports.js"
