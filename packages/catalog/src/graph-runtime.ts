import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
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
  api: readonly { surface: string }[],
): HonoModule {
  return {
    ...configured,
    ...(api.some(({ surface }) => surface === "admin")
      ? {}
      : { adminRoutes: undefined, lazyAdminRoutes: undefined }),
    ...(api.some(({ surface }) => surface === "public")
      ? {}
      : { publicRoutes: undefined, lazyPublicRoutes: undefined }),
  }
}

function selectedExtensionSurfaces(
  configured: HonoExtension,
  api: readonly { surface: string }[],
): HonoExtension {
  return {
    ...configured,
    ...(api.some(({ surface }) => surface === "admin")
      ? {}
      : { adminRoutes: undefined, lazyAdminRoutes: undefined }),
    ...(api.some(({ surface }) => surface === "public")
      ? {}
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
