import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

test("operator release archive contains only the minimal authored project", () => {
  assert.equal(
    existsSync(join(repoRoot, "packages/cli")),
    false,
    "CLI implementation must remain in the separate voyant-travel/cli repository",
  )
  const fixture = packageAndExtract()
  try {
    const files = listFiles(fixture.extractDir)
    assert.deepEqual(files, [
      ".env.example",
      "package.json",
      "src/scripts/seed.ts",
      "voyant.config.ts",
    ])

    for (const directory of [
      "src/api/admin",
      "src/api/public",
      "src/admin",
      "src/modules",
      "src/workflows",
      "src/jobs",
      "src/subscribers",
      "src/links",
    ]) {
      assert.equal(existsSync(join(fixture.extractDir, directory)), true, directory)
    }

    const config = readFileSync(join(fixture.extractDir, "voyant.config.ts"), "utf8")
    assert.doesNotMatch(config, /\b(?:modules|extensions|plugins|access)\s*:/)
    assert.doesNotMatch(config, /smartbill/i)
    assert.match(config, /target:\s*"node"/)
    assert.match(config, /database:\s*"postgres"/)

    const packageJson = JSON.parse(readFileSync(join(fixture.extractDir, "package.json"), "utf8"))
    assert.equal(packageJson.scripts.dev, "voyant develop")
    assert.equal(packageJson.scripts.build, "voyant build")
    assert.equal(packageJson.scripts.start, "voyant start")
    assert.equal(packageJson.scripts.seed, "voyant exec ./src/scripts/seed.ts")
    assert.equal(packageJson.scripts["db:migrate"], "voyant migrate")
    assert.equal(packageJson.scripts["graph:emit"], undefined)
    assert.equal(typeof packageJson.dependencies["@voyant-travel/framework"], "string")
    assert.equal(typeof packageJson.dependencies["@voyant-travel/runtime"], "string")
    assert.equal(packageJson.dependencies["@voyant-travel/plugin-smartbill"], undefined)
    const dependencySpecs = Object.values({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })
    assert.equal(
      dependencySpecs.some((specifier) => /^(?:workspace|file|link):/.test(specifier)),
      false,
    )
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true })
  }
})

function packageAndExtract(extraArgs = []) {
  const tempDir = mkdtempSync(join(tmpdir(), "voyant-package-starters-test-"))
  const outDir = join(tempDir, "out")
  const extractDir = join(tempDir, "extract")
  execFileSync(
    process.execPath,
    ["scripts/package-starters.mjs", "--version", "0.0.0-test", "--out-dir", outDir, ...extraArgs],
    { cwd: repoRoot, stdio: "pipe" },
  )
  mkdirSync(extractDir, { recursive: true })
  execFileSync(
    "tar",
    ["-xzf", join(outDir, "voyant-starter-operator-0.0.0-test.tar.gz"), "-C", extractDir],
    { stdio: "pipe" },
  )
  return { tempDir, outDir, extractDir }
}

function listFiles(root) {
  return walk(root)
    .filter((path) => !path.endsWith("/.DS_Store"))
    .map((path) => relative(root, path))
    .sort()
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}
