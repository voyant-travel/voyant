import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

test("operator starter archive includes bookable catalog seed inventory and standalone flights demo API package", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "voyant-package-starters-test-"))
  const outDir = join(tempDir, "out")
  const extractDir = join(tempDir, "extract")

  try {
    execFileSync(
      "node",
      ["scripts/package-starters.mjs", "--version", "0.0.0-test", "--out-dir", outDir],
      { cwd: repoRoot, stdio: "pipe" },
    )
    mkdirSync(extractDir, { recursive: true })
    execFileSync("tar", [
      "-xzf",
      join(outDir, "voyant-starter-operator-0.0.0-test.tar.gz"),
      "-C",
      extractDir,
    ])

    assert.equal(existsSync(join(extractDir, "apps", "flights-demo-api", "package.json")), true)
    assert.equal(existsSync(join(extractDir, "apps", "flights-demo-api", ".env.example")), true)
    assert.equal(
      existsSync(join(extractDir, "apps", "flights-demo-api", "docker-compose.yml")),
      true,
    )
    assert.equal(existsSync(join(extractDir, "scripts", "seed-catalog-verticals.ts")), true)
    assert.equal(existsSync(join(extractDir, "pnpm-workspace.yaml")), false)

    const seedScript = readFileSync(join(extractDir, "scripts", "seed.ts"), "utf8")
    assert.match(seedScript, /seedCruises/)
    assert.match(seedScript, /seedAccommodationRooms/)

    const verticalSeedScript = readFileSync(
      join(extractDir, "scripts", "seed-catalog-verticals.ts"),
      "utf8",
    )
    assert.match(verticalSeedScript, /cruiseSailings/)
    assert.match(verticalSeedScript, /cruiseCabinCategories/)
    assert.match(verticalSeedScript, /cruisePrices/)
    assert.match(verticalSeedScript, /ratePlans/)
    assert.match(verticalSeedScript, /ratePlanDailyRates/)
    assert.match(verticalSeedScript, /roomTypeDailyInventory/)

    const demoPackage = JSON.parse(
      readFileSync(join(extractDir, "apps", "flights-demo-api", "package.json"), "utf8"),
    )
    assert.equal(demoPackage.name, "flights-demo-api")
    assert.equal(demoPackage.scripts.dev, "tsx watch src/index.ts")
    assert.equal(demoPackage.scripts["db:migrate"], "tsx scripts/migrate.ts")
    const dependencySpecs = Object.values({
      ...demoPackage.dependencies,
      ...demoPackage.devDependencies,
    })
    assert.equal(
      dependencySpecs.some((spec) => spec === "catalog:"),
      false,
    )
    assert.equal(
      dependencySpecs.some((spec) => spec.startsWith("workspace:")),
      false,
    )
    assert.equal(
      demoPackage.devDependencies?.["@voyant-travel/voyant-typescript-config"],
      undefined,
    )

    const tsconfig = JSON.parse(
      readFileSync(join(extractDir, "apps", "flights-demo-api", "tsconfig.json"), "utf8"),
    )
    assert.equal(tsconfig.extends, undefined)
    assert.equal(tsconfig.compilerOptions.strict, true)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
