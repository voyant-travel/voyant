/**
 * Load a drizzle migrations folder (`meta/_journal.json` + `*.sql`) into the
 * ordered `MigrationStatement[]` the collector consumes. The framework bundle
 * and the deployment's own `migrations/` are both drizzle folders, so the same
 * loader reads either.
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { MigrationStatement } from "./collector.js"

interface JournalEntry {
  tag: string
  when: number
}

interface Journal {
  entries: JournalEntry[]
}

/**
 * Read `<folder>/meta/_journal.json` and each `<folder>/<tag>.sql`, returning
 * statements in journal order (ascending `when`). Throws if a referenced SQL
 * file is missing — a journal/file mismatch is a packaging error, not something
 * to apply partially.
 */
export async function loadMigrationFolder(folder: string): Promise<MigrationStatement[]> {
  const journalRaw = await readFile(join(folder, "meta", "_journal.json"), "utf8")
  const journal = JSON.parse(journalRaw) as Journal
  const entries = [...journal.entries].sort((a, b) => a.when - b.when)

  const statements: MigrationStatement[] = []
  for (const entry of entries) {
    const sql = await readFile(join(folder, `${entry.tag}.sql`), "utf8")
    statements.push({ tag: entry.tag, sql })
  }
  return statements
}
