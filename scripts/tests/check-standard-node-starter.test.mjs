import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterEach, test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const checker = join(repoRoot, "scripts/check-standard-node-starter.mjs")
const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test("accepts a minimal Node config with only external plugins and database selection", () => {
  const root = fixture()
  const output = run(root)
  assert.match(output, /1 standard selections hidden, no package bridges/)
})

test("rejects standard selections repeated by authored config", () => {
  const root = fixture({
    config: `export default defineConfig({ modules: [{ resolve: "@voyant-travel/identity" }] })\n`,
  })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("authored config must not declare modules"),
  )
})

test("rejects every package-specific Operator binding", () => {
  const root = fixture({
    composition: `export const operatorGraphRuntimeBindings = {
  "@voyant-travel/plugin-smartbill": () => undefined,
  "@voyant-travel/identity": () => undefined,
}\n`,
  })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("Operator package-specific runtime bindings remain"),
  )
})

function run(root) {
  return execFileSync(process.execPath, [checker, "--root", root], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  })
}

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "voyant-standard-node-starter-"))
  roots.push(root)
  const files = {
    "starters/operator/voyant.config.ts": `export default defineConfig({
  plugins: [{ resolve: "@voyant-travel/plugin-smartbill" }],
  deployment: { target: "node", providers: { database: "postgres" } },
})\n`,
    "packages/framework/src/operator-distribution.ts": `const modules = [{ resolve: "@voyant-travel/identity" }]\n`,
    "packages/framework/src/composition-lazy.ts": "export const frameworkComposition = {}\n",
    "starters/operator/src/api/composition.ts": "export const operatorGraphRuntimeBindings = {}\n",
    "packages/framework/src/project-artifact-paths.ts": `export const path = "product-bom.generated.json"\n`,
  }
  if (overrides.config) files["starters/operator/voyant.config.ts"] = overrides.config
  if (overrides.composition) {
    files["starters/operator/src/api/composition.ts"] = overrides.composition
  }
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(root, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, contents)
  }
  return root
}
