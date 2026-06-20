import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DEPLOYMENT_SOURCE,
  discoverMigrationSources,
  type Fs,
  packageDirOfSchemaPath,
} from "./discover-migration-sources.ts"

const SCRIPTS = "/repo/starters/operator/scripts"
const PKGS = "/repo/packages"

/** An in-memory fs: package.json contents keyed by dir, + which dirs ship a
 *  journal. */
function fakeFs(opts: {
  pkgs: Record<string, { name: string; requires?: string[] }>
  withJournal: string[] // dir names (or "deployment") whose migrations/meta exists
}): Fs {
  const files = new Map<string, string>()
  for (const [dir, pj] of Object.entries(opts.pkgs)) {
    files.set(
      join(PKGS, dir, "package.json"),
      JSON.stringify({ name: pj.name, voyant: { requiresSchemas: pj.requires ?? [] } }),
    )
  }
  const journals = new Set<string>()
  for (const d of opts.withJournal) {
    if (d === DEPLOYMENT_SOURCE) {
      journals.add(join(SCRIPTS, "..", "migrations", "meta", "_journal.json"))
    } else {
      journals.add(join(PKGS, d, "migrations", "meta", "_journal.json"))
    }
  }
  return {
    existsSync: (p) => journals.has(p),
    readFileSync: (p) => {
      const v = files.get(p)
      if (v === undefined) throw new Error(`unexpected read: ${p}`)
      return v
    },
  }
}

describe("packageDirOfSchemaPath", () => {
  it("extracts the package dir from a workspace schema path", () => {
    expect(packageDirOfSchemaPath("../../packages/db/src/schema/index.ts")).toBe("db")
    expect(packageDirOfSchemaPath("../../packages/flights/src/reference/local-postgres.ts")).toBe(
      "flights",
    )
  })

  it("returns null for a template-local (deployment) schema", () => {
    expect(packageDirOfSchemaPath("./drizzle.links.generated.ts")).toBeNull()
  })
})

describe("discoverMigrationSources", () => {
  it("orders deps-first and appends the deployment source last", () => {
    const fs = fakeFs({
      pkgs: {
        db: { name: "@voyant-travel/db" },
        identity: { name: "@voyant-travel/identity", requires: ["@voyant-travel/db"] },
        bookings: {
          name: "@voyant-travel/bookings",
          requires: ["@voyant-travel/db", "@voyant-travel/identity"],
        },
      },
      withJournal: ["db", "identity", "bookings", DEPLOYMENT_SOURCE],
    })
    // Config order lists bookings BEFORE its deps on purpose — discovery must
    // still topologically place db + identity ahead of bookings.
    const schema = [
      "../../packages/bookings/src/schema.ts",
      "../../packages/identity/src/schema.ts",
      "../../packages/db/src/schema/index.ts",
      "./drizzle.links.generated.ts",
    ]
    const got = discoverMigrationSources(schema, SCRIPTS, fs)
    expect(got.map((s) => s.name)).toEqual(["db", "identity", "bookings", DEPLOYMENT_SOURCE])
    // The deployment source resolves to ../migrations (operator root).
    expect(got.at(-1)?.migrationsDir).toBe(join(SCRIPTS, "..", "migrations"))
    expect(got.every((s) => s.hasMigrations)).toBe(true)
  })

  it("de-duplicates a package referenced by multiple schema paths", () => {
    const fs = fakeFs({
      pkgs: { db: { name: "@voyant-travel/db" } },
      withJournal: ["db"],
    })
    const got = discoverMigrationSources(
      ["../../packages/db/src/schema/index.ts", "../../packages/db/src/schema/other.ts"],
      SCRIPTS,
      fs,
    )
    expect(got.map((s) => s.name)).toEqual(["db"])
  })

  it("flags a source whose migrations folder is missing (hasMigrations=false)", () => {
    const fs = fakeFs({
      pkgs: {
        db: { name: "@voyant-travel/db" },
        widgets: { name: "@voyant-travel/widgets", requires: ["@voyant-travel/db"] },
      },
      withJournal: ["db"], // widgets ships NO journal
    })
    const got = discoverMigrationSources(
      ["../../packages/db/src/schema/index.ts", "../../packages/widgets/src/schema.ts"],
      SCRIPTS,
      fs,
    )
    expect(got.find((s) => s.name === "widgets")?.hasMigrations).toBe(false)
    expect(got.find((s) => s.name === "db")?.hasMigrations).toBe(true)
  })

  it("does not append a deployment source when no template-local schema is listed", () => {
    const fs = fakeFs({ pkgs: { db: { name: "@voyant-travel/db" } }, withJournal: ["db"] })
    const got = discoverMigrationSources(["../../packages/db/src/schema/index.ts"], SCRIPTS, fs)
    expect(got.map((s) => s.name)).toEqual(["db"])
  })

  it("tolerates a requiresSchemas dep that isn't a present source (external/type-only)", () => {
    const fs = fakeFs({
      pkgs: {
        db: { name: "@voyant-travel/db" },
        catalog: {
          name: "@voyant-travel/catalog",
          requires: ["@voyant-travel/db", "@voyant-travel/types"], // types not in the set
        },
      },
      withJournal: ["db", "catalog"],
    })
    const got = discoverMigrationSources(
      ["../../packages/catalog/src/schema.ts", "../../packages/db/src/schema/index.ts"],
      SCRIPTS,
      fs,
    )
    expect(got.map((s) => s.name)).toEqual(["db", "catalog"])
  })
})
