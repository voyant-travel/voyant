import { inboundEmailEnvelopeV1Schema } from "@voyant-travel/conversations-contracts"
import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  conversationIngressSourcePort,
  conversationsDatabaseRuntimePort,
  conversationsPersonDirectoryPort,
} from "./runtime-port.js"
import { ingestEnvelope } from "./service.js"

export interface IngressJobSummary {
  fetched: number
  committed: number
  duplicates: number
  acknowledged: number
}

export async function processConversationIngress(input: {
  db: PostgresJsDatabase
  sources: readonly import("@voyant-travel/conversations-contracts").ConversationIngressSource[]
  personDirectory?: import("./runtime-port.js").ConversationsPersonDirectory
  limit?: number
  /** Test seam for the commit boundary; production always uses `ingestEnvelope`. */
  ingest?: typeof ingestEnvelope
}): Promise<IngressJobSummary> {
  const summary: IngressJobSummary = { fetched: 0, committed: 0, duplicates: 0, acknowledged: 0 }
  for (const source of input.sources) {
    const page = await source.list({ limit: Math.min(input.limit ?? 50, 100) })
    for (const ref of page.items) {
      const envelope = inboundEmailEnvelopeV1Schema.parse(await source.fetch(ref))
      summary.fetched += 1
      const result = await (input.ingest ?? ingestEnvelope)(input.db, envelope, {
        personDirectory: input.personDirectory,
      })
      if (result.duplicate) summary.duplicates += 1
      else summary.committed += 1
      // Intentionally after commit. If the process dies here, replay returns duplicate and acks safely.
      await source.ack(ref)
      summary.acknowledged += 1
    }
  }
  return summary
}

export async function runConversationIngressJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const database = await context.getPort(conversationsDatabaseRuntimePort)
  const sources = await context.getPorts(conversationIngressSourcePort)
  const personDirectory = context.hasPort(conversationsPersonDirectoryPort)
    ? await context.getPort(conversationsPersonDirectoryPort)
    : undefined
  await processConversationIngress({
    db: database.resolveDb() as PostgresJsDatabase,
    sources,
    personDirectory,
  })
}
