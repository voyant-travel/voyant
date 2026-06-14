#!/usr/bin/env tsx
import { planBookingActionLedgerDriftRemediation } from "@voyant-travel/bookings/action-ledger-drift-remediation"
import { createDbClient } from "@voyant-travel/db"

const args = parseArgs(process.argv.slice(2))

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required")
  }

  const db = createDbClient(databaseUrl, {
    adapter: (process.env.DB_ADAPTER as "node" | "edge" | undefined) ?? "node",
  })

  const plan = await planBookingActionLedgerDriftRemediation(db, {
    createdAtFrom: args.createdAtFrom,
    sampleLimit: args.sampleLimit,
  })

  console.log(JSON.stringify(plan, null, 2))
}

function parseArgs(argv: string[]) {
  let createdAtFrom: string | null = null
  let sampleLimit: number | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--created-at-from") {
      index += 1
      createdAtFrom = requireValue(argv, index, arg)
      continue
    }
    if (arg === "--sample-limit") {
      index += 1
      const raw = requireValue(argv, index, arg)
      sampleLimit = Number(raw)
      if (!Number.isInteger(sampleLimit) || sampleLimit < 1) {
        throw new Error("--sample-limit must be a positive integer")
      }
      continue
    }
    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return { createdAtFrom, sampleLimit }
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index]
  if (!value) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

function printHelp() {
  console.log(`Usage:
  DATABASE_URL=postgres://... pnpm action-ledger:booking-drift:plan

Options:
  --created-at-from <iso-date>  Only inspect source rows at or after this timestamp.
  --sample-limit <n>           Maximum sample IDs per drift check, capped by package helper.
`)
}
