import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { createDbClient } from "@voyant-travel/db"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

const DB_AVAILABLE = Boolean(process.env.TEST_DATABASE_URL)

type UnsafeClient = {
  unsafe<T = unknown>(query: string): Promise<T>
  end(options?: { timeout?: number | null }): Promise<unknown>
}

describe.skipIf(!DB_AVAILABLE)("SMS conversations migration upgrade", () => {
  it("applies the real baseline then converts legacy delivery truth to admission truth", async () => {
    const schemaName = `conversation_sms_upgrade_${randomUUID().replaceAll("-", "")}`
    const db = createDbClient(process.env.TEST_DATABASE_URL as string, {
      adapter: "node",
      nodeMaxConnections: 1,
      timeouts: { statementMs: false, queryMs: false, connectMs: false },
    }) as PostgresJsDatabase & { $client: UnsafeClient }
    const client = db.$client
    try {
      await client.unsafe(`CREATE SCHEMA "${schemaName}"`)
      await client.unsafe(`SET search_path TO "${schemaName}", public`)
      const baseline = await readFile(
        new URL("../../migrations/0000_conversations_baseline.sql", import.meta.url),
        "utf8",
      )
      await client.unsafe(baseline.replaceAll('"public".', `"${schemaName}".`))
      await client.unsafe(`
        INSERT INTO conversations (
          id, reply_alias, customer_address, last_part_at
        ) VALUES (
          'conv_upgrade', 'reply@example.test', 'customer@example.test', now()
        );
        INSERT INTO conversation_parts (
          id, conversation_id, direction, sender_address, recipient_addresses,
          payload_fingerprint, delivery_status, occurred_at
        ) VALUES (
          'cvpa_upgrade', 'conv_upgrade', 'outbound', 'reply@example.test',
          '["customer@example.test"]'::jsonb, 'fingerprint', 'delivered', now()
        );
      `)
      const smsMigration = await readFile(
        new URL("../../migrations/0001_sms_conversations.sql", import.meta.url),
        "utf8",
      )
      await client.unsafe(smsMigration.replaceAll('"public".', `"${schemaName}".`))
      const rows = await client.unsafe<
        Array<{ admission_status: string; closed_at: Date | null }>
      >(`
        SELECT p.admission_status::text AS admission_status, c.closed_at
        FROM conversation_parts p
        JOIN conversations c ON c.id = p.conversation_id
      `)
      expect(rows).toEqual([{ admission_status: "admitted", closed_at: null }])
    } finally {
      await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await client.end({ timeout: 0 })
    }
  })
})
