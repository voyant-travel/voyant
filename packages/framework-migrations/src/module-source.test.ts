import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  collectManagedMigrationSources,
  loadModuleBundleSource,
  moduleSourceName,
} from "./module-source.js"

const frameworkBundleDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations")

/** Write a resolvable fake package with (optionally) a migrations/ folder. */
function writeFakePackage(
  root: string,
  packageName: string,
  { withMigrations }: { withMigrations: boolean },
): void {
  const pkgDir = join(root, "node_modules", ...packageName.split("/"))
  mkdirSync(pkgDir, { recursive: true })
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: packageName, version: "1.0.0", main: "index.js" }),
  )
  writeFileSync(join(pkgDir, "index.js"), "export {}\n")
  if (!withMigrations) return
  const migrationsDir = join(pkgDir, "migrations")
  mkdirSync(join(migrationsDir, "meta"), { recursive: true })
  writeFileSync(
    join(migrationsDir, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [{ idx: 0, tag: "0001_init", when: 1 }],
    }),
  )
  writeFileSync(join(migrationsDir, "0001_init.sql"), 'CREATE TABLE "loyalty_points" ("id" text);')
}

let root: string
let resolveFrom: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "voyant-module-source-"))
  resolveFrom = pathToFileURL(join(root, "consumer.js")).href
  writeFakePackage(root, "@acme/loyalty", { withMigrations: true })
  writeFakePackage(root, "@acme/analytics", { withMigrations: false })
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("moduleSourceName", () => {
  it("uses the unscoped package name as the stable ledger source name", () => {
    expect(moduleSourceName("@acme/loyalty")).toBe("loyalty")
    expect(moduleSourceName("@voyant-travel/bookings")).toBe("bookings")
    expect(moduleSourceName("plain-module")).toBe("plain-module")
  })
})

describe("loadModuleBundleSource (voyant#3069)", () => {
  it("loads a module package's pre-built migrations by name", async () => {
    const source = await loadModuleBundleSource("@acme/loyalty", { priority: 1, resolveFrom })

    expect(source).toEqual({
      name: "loyalty",
      priority: 1,
      migrations: [{ tag: "0001_init", sql: 'CREATE TABLE "loyalty_points" ("id" text);' }],
    })
  })

  it("returns null for a module that ships no migrations (owns no schema)", async () => {
    expect(await loadModuleBundleSource("@acme/analytics", { priority: 1, resolveFrom })).toBeNull()
  })

  it("returns null for an unresolvable package", async () => {
    expect(await loadModuleBundleSource("@acme/missing", { priority: 1, resolveFrom })).toBeNull()
  })

  it("honors an explicit migrationsDir, bypassing package resolution", async () => {
    const source = await loadModuleBundleSource("@acme/loyalty", {
      priority: 3,
      name: "custom-ledger-name",
      migrationsDir: join(root, "node_modules", "@acme", "loyalty", "migrations"),
    })
    expect(source?.name).toBe("custom-ledger-name")
    expect(source?.priority).toBe(3)
  })
})

describe("collectManagedMigrationSources (voyant#3069)", () => {
  it("orders the framework bundle first, then custom modules deps-first", async () => {
    const sources = await collectManagedMigrationSources({
      frameworkBundleDir,
      modulePackages: ["@acme/loyalty"],
      resolveFrom,
    })

    expect(sources[0]?.name).toBe("framework")
    expect(sources[0]?.priority).toBe(0)
    expect(sources.map((s) => s.name)).toContain("loyalty")
    expect(sources.find((s) => s.name === "loyalty")?.priority).toBe(1)
  })

  it("skips declared modules that ship no migrations", async () => {
    const sources = await collectManagedMigrationSources({
      frameworkBundleDir,
      modulePackages: ["@acme/analytics", "@acme/loyalty"],
      resolveFrom,
    })

    expect(sources.map((s) => s.name)).toEqual(["framework", "loyalty"])
    // Priority is assigned only to loaded modules — no gap from the skipped one.
    expect(sources.find((s) => s.name === "loyalty")?.priority).toBe(1)
  })
})
