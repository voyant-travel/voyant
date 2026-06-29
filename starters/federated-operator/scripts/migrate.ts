import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  discoverMigrationSources,
  loadCutline,
  loadMigrationFolder,
  type MigrationSource,
  runDeploymentMigrations,
} from "@voyant-travel/framework-migrations"
import { config } from "dotenv"
import { Client } from "pg"
import { schema } from "../drizzle.schemas.generated.ts"

const explicitDatabaseUrl = process.env.DATABASE_URL
config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })
if (explicitDatabaseUrl) process.env.DATABASE_URL = explicitDatabaseUrl

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const baseDir = path.resolve(scriptsDir, "..")
const client = new Client({ connectionString: databaseUrl })

try {
  await client.connect()

  const discovered = discoverMigrationSources(schema, {
    baseDir,
    deploymentMigrationsDir: path.join(baseDir, "migrations"),
  })
  const sources: MigrationSource[] = []
  for (let i = 0; i < discovered.length; i++) {
    const d = discovered[i] as (typeof discovered)[number]
    if (!d.hasMigrations) {
      throw new Error(
        `migration source '${d.name}' has no migrations folder at ${d.migrationsDir}. ` +
          "Regenerate the schema list and verify the owning package publishes migrations/*.sql " +
          "and migrations/meta/_journal.json.",
      )
    }
    sources.push({
      name: d.name,
      priority: i,
      migrations: await loadMigrationFolder(d.migrationsDir),
    })
  }

  const cutline = await loadCutline()
  const { executed, baselined } = await runDeploymentMigrations(client, sources, cutline, {
    onApplied: (id) => console.log(`applied ${id}`),
    onBaselined: (id) => console.log(`baselined ${id}`),
  })

  const total = executed.length + baselined.length
  if (total === 0) {
    console.log("No pending migrations.")
  } else {
    console.log(
      `Recorded ${total} migration(s): ${executed.length} executed, ${baselined.length} baselined.`,
    )
  }
} finally {
  await client.end()
}
