import { staffDirectoryRuntimePort } from "@voyant-travel/auth/staff-directory-runtime-port"
import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  conversationsAttachmentRuntimePort,
  conversationsDatabaseRuntimePort,
  conversationsPersonDirectoryPort,
  conversationsRenderedMessageAdmissionPort,
} from "./runtime-port.js"
import { conversationsModule } from "./schema.js"

export * from "./attachment-runtime.js"
export * from "./content-security.js"
export * from "./runtime-port.js"
export * from "./schema.js"
export * from "./service.js"
export * from "./threading.js"

export function createConversationsApiModule(
  options: import("./routes.js").ConversationsRoutesOptions,
): ApiModule {
  const module: Module = conversationsModule
  return {
    module,
    lazyRoutes: {
      paths: [
        "/v1/admin/conversations",
        "/v1/admin/conversations/*",
        "/v1/admin/conversation-inboxes",
        "/v1/admin/conversation-inboxes/*",
      ],
      load: () =>
        import("./routes.js").then(({ createConversationsRoutes }) =>
          createConversationsRoutes(options),
        ),
    },
  }
}

export const createConversationsVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort, hasPort }) => {
    const database = await getPort(conversationsDatabaseRuntimePort)
    return createConversationsApiModule({
      resolveDb: (bindings) => database.resolveDb(bindings) as PostgresJsDatabase,
      admission: hasPort(conversationsRenderedMessageAdmissionPort)
        ? await getPort(conversationsRenderedMessageAdmissionPort)
        : undefined,
      personDirectory: hasPort(conversationsPersonDirectoryPort)
        ? await getPort(conversationsPersonDirectoryPort)
        : undefined,
      staffDirectory: await getPort(staffDirectoryRuntimePort),
      attachments: hasPort(conversationsAttachmentRuntimePort)
        ? await getPort(conversationsAttachmentRuntimePort)
        : undefined,
    })
  },
)
