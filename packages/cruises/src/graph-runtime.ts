import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createCruiseContentHonoExtension } from "./routes-content.js"
import { cruisesContentRuntimePort } from "./runtime-port.js"

export const createCruisesContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const configured = createCruiseContentHonoExtension(await getPort(cruisesContentRuntimePort))
    return {
      ...configured,
      extension: { ...configured.extension, name: "cruises-content" },
      ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
      ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
    }
  },
)

export { cruisesContentRuntimePort } from "./runtime-port.js"
