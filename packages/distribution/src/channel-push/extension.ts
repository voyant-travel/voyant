import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Extension } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"
import { Hono } from "hono"

import { createChannelPushAdminRoutes } from "./admin-routes.js"
import { channelPushRuntimePort } from "./runtime-port.js"
import { type ChannelPushDeps, type ChannelPushLogger, setChannelPushDeps } from "./types.js"

type ChannelPushExtensionEnv = {
  Variables: {
    db: ChannelPushDeps["db"]
    userId?: string
  }
}

export interface ChannelPushExtensionOptions {
  resolveRegistry: (c: Context<ChannelPushExtensionEnv>) => SourceAdapterRegistry
  resolveDb?: (c: Context<ChannelPushExtensionEnv>) => ChannelPushDeps["db"]
  logger?: ChannelPushLogger
}

export const channelPushExtensionDef: Extension = {
  name: "channel-push",
  module: "distribution",
}

export function createChannelPushExtension(options: ChannelPushExtensionOptions): HonoExtension {
  const adminRoutes = new Hono<ChannelPushExtensionEnv>()
  adminRoutes.use("*", async (c, next) => {
    setChannelPushDeps({
      db: options.resolveDb?.(c) ?? c.get("db"),
      registry: options.resolveRegistry(c),
      ...(options.logger ? { logger: options.logger } : {}),
    })
    await next()
  })
  adminRoutes.route("/", createChannelPushAdminRoutes())
  return { extension: channelPushExtensionDef, adminRoutes }
}

/** Package-owned adapter from graph runtime dependencies to channel-push routes and services. */
export const createChannelPushVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) => {
  const runtime = await getPort(channelPushRuntimePort)
  const configured = createChannelPushExtension({ resolveRegistry: runtime.resolveRegistry })
  const bootstrap = configured.extension.bootstrap

  return {
    ...configured,
    extension: {
      ...configured.extension,
      bootstrap: async (context) => {
        await runtime.registerWorkflowService(context)
        await bootstrap?.(context)
      },
    },
  }
})
