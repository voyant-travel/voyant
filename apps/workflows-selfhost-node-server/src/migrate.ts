import { runPostgresMigrations } from "@voyant-travel/workflows-orchestrator"

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("voyant workflows selfhost: DATABASE_URL is required to run migrations")
  }

  const outcome = await runPostgresMigrations({
    databaseUrl,
    logger: (message) => {
      console.error(`voyant workflows selfhost: ${message}`)
    },
  })

  console.error(
    `voyant workflows selfhost: migrations complete ` +
      `(applied=${outcome.applied.length}, skipped=${outcome.skipped.length})`,
  )
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})
