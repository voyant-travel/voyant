import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checker = path.join(repoRoot, "scripts/check-catalog-runtime-authority.mjs")

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-catalog-runtime-authority-"))
  const entries = [
    "packages/catalog/package.json",
    "packages/catalog/src",
    ...[
      "accommodations",
      "charters",
      "commerce",
      "cruises",
      "distribution",
      "inventory",
      "operations",
      "plugins/catalog-demo",
    ].flatMap((directory) => [
      `packages/${directory}/package.json`,
      `packages/${directory}/src/catalog-runtime-extension.ts`,
    ]),
    "packages/framework/src/runtime-packages.generated.ts",
    "packages/framework/src/runtime-contributors.generated.ts",
    "packages/typescript-config/dep-paths.json",
    "starters/operator/src/api/runtime/deployment-resources.ts",
    "release.runtime-packages.generated.json",
    "pnpm-lock.yaml",
  ]
  for (const entry of entries) {
    const target = path.join(root, entry)
    await mkdir(path.dirname(target), { recursive: true })
    await cp(path.join(repoRoot, entry), target, { recursive: true })
  }
  return root
}

test("accepts the acyclic Catalog-owned runtime fixture", async () => {
  const root = await fixture()
  const result = await execFileAsync(process.execPath, [checker, "--root", root])
  assert.match(result.stdout, /acyclic Catalog-owned runtime/)
  await rm(root, { recursive: true })
})

test("rejects a direct Catalog-to-Inventory dependency cycle", async () => {
  const root = await fixture()
  const file = path.join(root, "packages/catalog/package.json")
  const manifest = JSON.parse(await readFile(file, "utf8"))
  manifest.dependencies["@voyant-travel/inventory"] = "workspace:^"
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /must invert the @voyant-travel\/inventory runtime edge/,
  )
  await rm(root, { recursive: true })
})

test("rejects starter-owned Catalog capability authority", async () => {
  const root = await fixture()
  const file = path.join(root, "starters/operator/src/api/runtime/deployment-resources.ts")
  await writeFile(file, `${await readFile(file, "utf8")}\nconst loadCatalogRuntime = true\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /starter must not own Catalog runtime capabilities/,
  )
  await rm(root, { recursive: true })
})
