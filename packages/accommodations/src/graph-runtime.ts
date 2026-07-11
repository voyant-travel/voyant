import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createAccommodationContentHonoExtension } from "./routes-content.js"
import { accommodationsContentRuntimePort } from "./runtime-port.js"

export const createAccommodationsContentVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const configured = createAccommodationContentHonoExtension(
      await getPort(accommodationsContentRuntimePort),
    )
    return {
      ...configured,
      ...(api.some(({ surface }) => surface === "admin") ? {} : { adminRoutes: undefined }),
      ...(api.some(({ surface }) => surface === "public") ? {} : { publicRoutes: undefined }),
    }
  },
)

export { accommodationsContentRuntimePort } from "./runtime-port.js"
