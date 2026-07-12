import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"

import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
import { createCatalogBookingEngineHonoModule } from "./booking-engine/operator-routes.js"
import { createCatalogOffersHonoExtension } from "./offers/operator-routes.js"
import { createCatalogSearchHonoModule } from "./search/routes.js"
import { executeSemanticSearch } from "./search/semantic.js"

function selectedModuleSurfaces(
  configured: HonoModule,
  api: readonly { id: string; surface: string }[],
): HonoModule {
  const adminApiId = api.find(({ surface }) => surface === "admin")?.id
  const publicApiId = api.find(({ surface }) => surface === "public")?.id
  return {
    ...configured,
    ...(adminApiId
      ? {
          adminRoutes: stampOpenApiRegistryApiId(configured.adminRoutes, adminApiId),
        }
      : { adminRoutes: undefined, lazyAdminRoutes: undefined }),
    ...(publicApiId
      ? {
          publicRoutes: stampOpenApiRegistryApiId(configured.publicRoutes, publicApiId),
        }
      : { publicRoutes: undefined, lazyPublicRoutes: undefined }),
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
      ? {
          adminRoutes: stampOpenApiRegistryApiId(configured.adminRoutes, adminApiId),
        }
      : { adminRoutes: undefined, lazyAdminRoutes: undefined }),
    ...(publicApiId
      ? {
          publicRoutes: stampOpenApiRegistryApiId(configured.publicRoutes, publicApiId),
        }
      : { publicRoutes: undefined, lazyPublicRoutes: undefined }),
  }
}

export const createCatalogSearchVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const runtime = await getPort(catalogSearchRuntimePort)
    return selectedModuleSurfaces(
      createCatalogSearchHonoModule({
        ...runtime,
        executeSearch: ({ adapter, embeddings, slice, request }) =>
          executeSemanticSearch({
            adapter,
            embeddings: embeddings as Parameters<typeof executeSemanticSearch>[0]["embeddings"],
            slice,
            request,
          }),
      }),
      api,
    )
  },
)

export const createCatalogBookingVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) =>
    selectedModuleSurfaces(
      createCatalogBookingEngineHonoModule(await getPort(catalogBookingRuntimePort)),
      api,
    ),
)

export const createCatalogOffersVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) =>
    selectedExtensionSurfaces(
      createCatalogOffersHonoExtension(await getPort(catalogOffersRuntimePort)),
      api,
    ),
)

export type { CatalogSearchRuntimeOptions } from "./api-runtime-ports.js"
export {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "./api-runtime-ports.js"
export { catalogContentRuntimePort } from "./content-runtime-port.js"
