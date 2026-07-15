import { catalogContentRuntimePort } from "@voyant-travel/catalog/runtime-port"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createAccommodationContentApiExtension } from "./routes-content.js"

export const createAccommodationsContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const runtime = await getPort(catalogContentRuntimePort)
    const configured = createAccommodationContentApiExtension({
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
