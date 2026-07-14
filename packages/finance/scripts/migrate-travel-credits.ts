#!/usr/bin/env -S node --experimental-strip-types --experimental-transform-types
/**
 * One-shot data migration: legacy stored value living as payment_instruments
 * rows with instrumentType='travel_credit' after the schema migration and
 * balance in metadata JSONB becomes first-class Travel Credits. Idempotent;
 * safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm -F @voyant-travel/finance migrate:travel-credits
 *   DATABASE_URL=postgres://... pnpm -F @voyant-travel/finance migrate:travel-credits --dry-run
 */
import { createDbClient } from "@voyant-travel/db"

import { migrateTravelCreditsFromPaymentInstruments } from "../src/service-travel-credits-migration.ts"

function parseArgs(argv: string[]): { dryRun: boolean; help: boolean } {
  let dryRun = false
  let help = false
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "-n") dryRun = true
    else if (arg === "--help" || arg === "-h") help = true
  }
  return { dryRun, help }
}

const HELP = `migrate-travel-credits - backfill Travel Credits from legacy payment_instruments rows

Usage:
  DATABASE_URL=postgres://... tsx scripts/migrate-travel-credits.ts [options]

Options:
  -n, --dry-run    Report what would be migrated without writing
  -h, --help       Show this message

The script is idempotent when an existing Travel Credit matches the legacy
record. Invalid rows and conflicting codes are reported as failures so stored
value cannot be silently stranded.`

async function main(argv: string[]) {
  const { dryRun, help } = parseArgs(argv.slice(2))

  if (help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write("DATABASE_URL is required\n")
    return 1
  }

  const db = createDbClient(url, { adapter: "node" })

  const started = Date.now()
  const result = await migrateTravelCreditsFromPaymentInstruments(db, {
    dryRun,
    onRowMigrated: ({ travelCreditCode }) => {
      process.stdout.write(`  ${dryRun ? "would migrate" : "migrated"} ${travelCreditCode}\n`)
    },
  })

  const elapsed = ((Date.now() - started) / 1000).toFixed(2)
  process.stdout.write(`\nDone in ${elapsed}s${dryRun ? " (dry run)" : ""}\n`)
  process.stdout.write(`  candidates: ${result.candidates}\n`)
  process.stdout.write(`  migrated:   ${result.migrated}\n`)
  process.stdout.write(`  skipped:    ${result.skipped.length}\n`)

  if (result.skipped.length > 0) {
    const reasons = result.skipped.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.reason] = (acc[entry.reason] ?? 0) + 1
      return acc
    }, {})
    for (const [reason, count] of Object.entries(reasons)) {
      process.stdout.write(`    - ${reason}: ${count}\n`)
    }
  }

  return result.skipped.some((entry) => entry.reason !== "already_migrated") ? 1 : 0
}

main(process.argv)
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : error}\n`)
    process.exit(1)
  })
