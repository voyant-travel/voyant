import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { cleanupConversationAttachments } from "./attachment-service.js"
import {
  conversationsAttachmentRuntimePort,
  conversationsDatabaseRuntimePort,
} from "./runtime-port.js"

export async function runConversationAttachmentRetentionJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  if (!context.hasPort(conversationsAttachmentRuntimePort)) return
  const [database, attachments] = await Promise.all([
    context.getPort(conversationsDatabaseRuntimePort),
    context.getPort(conversationsAttachmentRuntimePort),
  ])
  await cleanupConversationAttachments(database.resolveDb() as PostgresJsDatabase, attachments)
}
