import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { conversationsDatabaseRuntimePort } from "./runtime-port.js"
import { expireSnoozedConversations } from "./service.js"

export async function runConversationSnoozeExpiryJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const database = await context.getPort(conversationsDatabaseRuntimePort)
  await expireSnoozedConversations(database.resolveDb() as PostgresJsDatabase)
}
