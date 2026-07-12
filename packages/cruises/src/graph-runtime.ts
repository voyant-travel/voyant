import { catalogContentRuntimePort } from "@voyant-travel/catalog/graph-runtime"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createCruiseContentHonoExtension } from "./routes-content.js"

export const createCruisesContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const runtime = await getPort(catalogContentRuntimePort)
    const configured = createCruiseContentHonoExtension({
      admin: {
        resolveRegistry: runtime.resolveRegistry,
        defaultAcceptMachineTranslated: false,
        allowOwnedKeys: true,
      },
      public: {
        resolveRegistry: runtime.resolveRegistry,
        defaultAcceptMachineTranslated: true,
        allowOwnedKeys: true,
      },
    })
    return {
      ...configured,
      extension: { ...configured.extension, name: "cruises-content" },
      ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
      ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
    }
  },
)
