import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  executeNodeMigrationPlan,
  loadNodeSchemaMigrationSource,
  type NodeMigrationRunnerDependencies,
  type SetupMigrationHandler,
} from "./node-migration-runner.js"
import type { VoyantProjectMigrationPlan } from "./project-resolver.js"

const HASH = `sha256:${"a".repeat(64)}`

describe("Node migration runner", () => {
  it("applies schemas before setup work and skips both ledgers on a repeated run", async () => {
    const events: string[] = []
    const fixture = runnerFixture(events)
    const setup: SetupMigrationHandler = async () => {
      events.push("setup:run")
    }

    const first = await executeNodeMigrationPlan(
      plan(),
      { resolveFrom: import.meta.url, setupLoaders: { "finance#setup": async () => setup } },
      { databaseUrl: "postgres://test" },
      fixture.dependencies,
    )
    const second = await executeNodeMigrationPlan(
      plan(),
      { resolveFrom: import.meta.url, setupLoaders: { "finance#setup": async () => setup } },
      { databaseUrl: "postgres://test" },
      fixture.dependencies,
    )

    expect(events).toEqual(["schema:finance#migrations", "setup:run", "schema:finance#migrations"])
    expect(first.applied.map((entry) => entry.id)).toEqual(["finance#migrations", "finance#setup"])
    expect(first.failed).toEqual([])
    expect(second.skipped.map((entry) => [entry.id, entry.detail])).toEqual([
      ["finance#migrations", "already_applied"],
      ["finance#setup", "already_applied"],
    ])
  })

  it("rolls back failed setup work, reports the failure, and stops later work", async () => {
    const events: string[] = []
    const fixture = runnerFixture(events)
    const loaders = {
      "finance#setup": async () => async () => {
        events.push("setup:fail")
        throw new Error("voucher backfill failed")
      },
      "finance#later": async () => async () => {
        events.push("setup:later")
      },
    }

    const result = await executeNodeMigrationPlan(
      plan(true),
      { resolveFrom: import.meta.url, setupLoaders: loaders },
      { databaseUrl: "postgres://test" },
      fixture.dependencies,
    )

    expect(result.failed).toEqual([
      expect.objectContaining({
        id: "finance#setup",
        status: "failed",
        detail: "voucher backfill failed",
      }),
    ])
    expect(events).toEqual(["schema:finance#migrations", "setup:fail", "rollback"])
    expect(fixture.setupLedger).toEqual(new Set())
  })

  it("dry-runs without connecting or writing either ledger", async () => {
    const events: string[] = []
    const fixture = runnerFixture(events)
    const result = await executeNodeMigrationPlan(
      plan(),
      { resolveFrom: import.meta.url, setupLoaders: {} },
      { dryRun: true },
      fixture.dependencies,
    )

    expect(events).toEqual([])
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped.every((entry) => entry.detail === "dry_run")).toBe(true)
  })

  it("loads deployment migration folders relative to the deployment package root", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "voyant-deployment-migrations-"))
    try {
      mkdirSync(path.join(root, "src"), { recursive: true })
      mkdirSync(path.join(root, "migrations", "meta"), { recursive: true })
      writeFileSync(path.join(root, "package.json"), '{"name":"deployment"}\n')
      writeFileSync(
        path.join(root, "migrations", "meta", "_journal.json"),
        JSON.stringify({ entries: [{ tag: "0000_links", when: 1 }] }),
      )
      writeFileSync(path.join(root, "migrations", "0000_links.sql"), "create table links ();\n")

      const source = await loadNodeSchemaMigrationSource(
        {
          id: "deployment",
          migrationKind: "schema",
          order: 4,
          idempotencyKey: "schema:deployment",
          owner: "deployment",
          source: { kind: "deployment", path: "./migrations" },
        },
        path.join(root, "src", "migrate.mjs"),
      )

      expect(source).toEqual({
        name: "deployment",
        priority: 4,
        migrations: [{ tag: "0000_links", sql: "create table links ();\n" }],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("uses the stable package ledger source name for package migrations", async () => {
    const source = await loadNodeSchemaMigrationSource(
      {
        id: "@voyant-travel/finance#migrations",
        migrationKind: "schema",
        order: 9,
        idempotencyKey: "schema:@voyant-travel/finance#migrations",
        owner: "@voyant-travel/finance",
        packageName: "@voyant-travel/finance",
        source: {
          kind: "package",
          packageName: "@voyant-travel/finance",
          path: "./migrations",
        },
      },
      import.meta.url,
    )

    expect(source.name).toBe("finance")
    expect(source.legacyNames).toEqual(["schema:@voyant-travel/finance#migrations"])
    expect(source.priority).toBe(9)
    expect(source.migrations.length).toBeGreaterThan(0)
  })

  it("loads built-in workflow migrations without a deployment-root dependency", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "voyant-workflow-migrations-"))
    const resolveFrom = path.join(root, "migration-runner.mjs")
    writeFileSync(resolveFrom, "export {}\n")

    try {
      const source = await loadNodeSchemaMigrationSource(
        {
          id: "@voyant-travel/workflows-orchestrator#migrations",
          migrationKind: "schema",
          order: 1,
          idempotencyKey: "schema:@voyant-travel/workflows-orchestrator#migrations",
          owner: "@voyant-travel/workflows-orchestrator",
          packageName: "@voyant-travel/workflows-orchestrator",
          source: {
            kind: "package",
            packageName: "@voyant-travel/workflows-orchestrator",
            path: "./migrations",
          },
        },
        resolveFrom,
      )

      expect(source.name).toBe("workflows-orchestrator")
      expect(source.migrations.map((migration) => migration.tag)).toEqual([
        "0000_init",
        "0001_persist_run_record",
        "0002_allow_null_input",
        "0003_idempotency_key",
        "0004_workflow_manifests",
        "0005_wakeup_priority",
      ])
      expect(source.migrations.map((migration) => migration.sql).join("\n")).toContain(
        'CREATE TABLE IF NOT EXISTS "voyant_workflow_manifests"',
      )
      expect(source.migrations.map((migration) => migration.sql).join("\n")).toContain(
        'CREATE TABLE IF NOT EXISTS "voyant_wakeups"',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

function plan(includeLater = false): VoyantProjectMigrationPlan {
  return {
    schemaVersion: "voyant.migration-plan.v1",
    contentHash: HASH,
    migrations: [
      {
        id: "finance#migrations",
        migrationKind: "schema",
        order: 0,
        idempotencyKey: "schema:finance#migrations",
        owner: "finance",
        packageName: "@voyant-travel/finance",
        source: {
          kind: "package",
          packageName: "@voyant-travel/finance",
          path: "./migrations",
        },
      },
      {
        id: "finance#setup",
        migrationKind: "setup",
        order: 1,
        idempotencyKey: "setup:finance#setup",
        owner: "finance",
        packageName: "@voyant-travel/finance",
        source: "@voyant-travel/finance/setup/vouchers",
        runtime: {
          entry: "@voyant-travel/finance/setup/vouchers",
          export: "runVoucherSetupMigration",
        },
        dependsOn: ["finance#migrations"],
      },
      ...(includeLater
        ? [
            {
              id: "finance#later",
              migrationKind: "setup" as const,
              order: 2,
              idempotencyKey: "setup:finance#later",
              owner: "finance",
              packageName: "@voyant-travel/finance",
              source: "@voyant-travel/finance/setup/later",
              runtime: {
                entry: "@voyant-travel/finance/setup/later",
                export: "runLater",
              },
              dependsOn: ["finance#setup"],
            },
          ]
        : []),
    ],
  }
}

function runnerFixture(events: string[]) {
  const schemaLedger = new Set<string>()
  const setupLedger = new Set<string>()
  const dependencies: NodeMigrationRunnerDependencies = {
    async connect() {
      return {
        async query(sql, params = []) {
          if (sql === "ROLLBACK") events.push("rollback")
          if (sql.startsWith("SELECT") && sql.includes("_voyant_setup_migrations")) {
            return {
              rows: setupLedger.has(String(params[0])) ? [{ idempotency_key: params[0] }] : [],
            }
          }
          if (sql.startsWith("INSERT INTO") && sql.includes("_voyant_setup_migrations")) {
            setupLedger.add(String(params[0]))
          }
          return { rows: [] }
        },
        async end() {},
      }
    },
    async loadSchemaSource(migration) {
      events.push(`schema:${migration.id}`)
      return { name: migration.idempotencyKey, priority: migration.order, migrations: [] }
    },
    async runSchema(_client, source) {
      if (schemaLedger.has(source.name)) return { existing: false, executed: [], baselined: [] }
      schemaLedger.add(source.name)
      return { existing: false, executed: [`${source.name}/0000`], baselined: [] }
    },
  }
  return { dependencies, setupLedger }
}
