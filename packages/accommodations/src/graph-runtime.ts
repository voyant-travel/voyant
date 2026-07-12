import { catalogContentRuntimePort } from "@voyant-travel/catalog/graph-runtime"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createAccommodationContentHonoExtension } from "./routes-content.js"

export const createAccommodationsContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const runtime = await getPort(catalogContentRuntimePort)
    const configured = createAccommodationContentHonoExtension({
      admin: {
        resolveRegistry: runtime.resolveRegistry,
        defaultAcceptMachineTranslated: false,
      },
      public: {
        resolveRegistry: runtime.resolveRegistry,
        defaultAcceptMachineTranslated: true,
      },
    })
    return {
      ...configured,
      extension: { ...configured.extension, name: "accommodations-content" },
      ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
      ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
    }
  },
)
