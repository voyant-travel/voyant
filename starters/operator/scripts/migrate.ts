import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  createProjectMigrationPlan,
  executeNodeMigrationPlan,
  type SetupMigrationHandler,
  type VoyantProjectMigrationPlan,
  type VoyantProjectSetupMigration,
} from "@voyant-travel/framework/project"
import { config } from "dotenv"
import type { ResolvedVoyantDeploymentGraph } from "../../../packages/framework/src/deployment-graph"
import {
  assertOperatorDeploymentGraphResourceEnv,
  loadOperatorDeploymentGraphArtifacts,
} from "../src/deployment-graph-artifacts"

export async function runOperatorMigrations(options: {
  databaseUrl: string
  graph: ResolvedVoyantDeploymentGraph
}) {
  const plan = await createProjectMigrationPlan(options.graph)
  return executeNodeMigrationPlan(
    plan,
    {
      resolveFrom: import.meta.url,
      setupLoaders: createSetupLoaders(plan),
    },
    { databaseUrl: options.databaseUrl },
  )
}

export function createSetupLoaders(
  plan: VoyantProjectMigrationPlan,
): Readonly<Record<string, () => Promise<SetupMigrationHandler>>> {
  return Object.fromEntries(
    plan.migrations
      .filter(
        (migration): migration is VoyantProjectSetupMigration =>
          migration.migrationKind === "setup",
      )
      .map((migration) => [
        migration.id,
        async () => {
          const module = (await import(migration.runtime.entry)) as Record<string, unknown>
          const handler = module[migration.runtime.export]
          if (typeof handler !== "function") {
            throw new Error(
              `Setup migration ${migration.id} must export ${migration.runtime.export} as a function.`,
            )
          }
          return handler as SetupMigrationHandler
        },
      ]),
  )
}

async function main(): Promise<void> {
  const explicitDatabaseUrl = process.env.DATABASE_URL
  config({ path: ".env" })
  config({ path: "../../.env" })
  config({ path: "../../.env.local" })
  config({ path: ".env", override: true })
  if (explicitDatabaseUrl) process.env.DATABASE_URL = explicitDatabaseUrl

  const artifacts = loadOperatorDeploymentGraphArtifacts()
  assertOperatorDeploymentGraphResourceEnv(artifacts, process.env)
  const databaseUrl = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is not set")

  const graphPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.voyant/deployment-graph.generated.json",
  )
  const graph = JSON.parse(await readFile(graphPath, "utf8")) as ResolvedVoyantDeploymentGraph
  if (graph.contentHash !== artifacts.graphHash) {
    throw new Error(
      `Migration graph hash ${graph.contentHash} does not match admitted artifact ${artifacts.graphHash}`,
    )
  }

  const report = await runOperatorMigrations({ databaseUrl, graph })
  for (const migration of report.applied) console.log(`applied ${migration.id}`)
  for (const migration of report.skipped) console.log(`skipped ${migration.id}`)
  for (const migration of report.failed)
    console.error(`failed ${migration.id}: ${migration.detail}`)
  if (report.failed.length > 0) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
