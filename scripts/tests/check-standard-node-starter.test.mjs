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

test("accepts the strict generated standard Node starter shape", () => {
  const root = fixture()
  assert.match(
    run(root),
    /packaged: 4 authored files; checked-in: no database authority; generic Node bootstrap/,
  )
})

test("rejects an environment example without a DATABASE_URL assignment", () => {
  const root = fixture({
    extraFiles: { ".env.example": "postgresql://localhost/voyant\nPORT=8080\n" },
  })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("generated .env.example must declare DATABASE_URL"),
  )
})

test("rejects standard modules, extensions, and plugins in generated config", () => {
  for (const property of ["modules", "extensions", "plugins"]) {
    const root = fixture({
      config: `export default defineConfig({ ${property}: [{ resolve: "@voyant-travel/identity" }] })\n`,
    })
    assert.throws(
      () => run(root),
      (error) => String(error.stderr).includes(`generated config must not declare ${property}`),
    )
  }
})

test("rejects SmartBill selection and configuration in the standard starter", () => {
  const root = fixture({
    config:
      'export default defineConfig({ plugins: [{ resolve: "@voyant-travel/plugin-smartbill" }] })\n',
  })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("must not select or configure SmartBill by default"),
  )
})

test("rejects package-owned artifacts and non-empty project convention folders", () => {
  for (const path of [
    "openapi/admin/bookings.json",
    "migrations/0000_product.sql",
    "src/links/booking-customer.ts",
    "src/subscribers/booking-created.ts",
  ]) {
    const root = fixture({ extraFiles: { [path]: "export default {}\n" } })
    assert.throws(() => run(root), /generated authored tree|must not contain|must start empty/)
  }
})

test("rejects package-specific bootstrap dependencies and commands", () => {
  const root = fixture({
    packageJson: {
      scripts: { start: "tsx src/start.ts" },
      dependencies: {
        "@voyant-travel/framework": "1.0.0",
        "@voyant-travel/operator-runtime": "1.0.0",
        "@voyant-travel/bookings": "1.0.0",
      },
      devDependencies: { "@voyant-travel/cli": "1.0.0" },
    },
  })
  assert.throws(
    () => run(root),
    (error) =>
      String(error.stderr).includes('generic "voyant-operator start" Node bootstrap') &&
      String(error.stderr).includes("generic Node runtime"),
  )
})

test("rejects extra authored files beyond the small-tree ratchet", () => {
  const root = fixture({ extraFiles: { "src/start.ts": "export const product = true\n" } })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("must contain exactly 4 files"),
  )
})

test("rejects first-party package IDs in the authored seed source", () => {
  const root = fixture({
    extraFiles: {
      "src/scripts/seed.ts": 'export const packageId = "@voyant-travel/bookings"\n',
    },
  })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("must not name first-party packages"),
  )
})

test("rejects a missing optional project convention directory", () => {
  const root = fixture()
  rmSync(join(root, "src/jobs"), { recursive: true })
  assert.throws(
    () => run(root),
    (error) => String(error.stderr).includes("must expose optional project directory src/jobs"),
  )
})

test("rejects database authority in the checked-in starter", () => {
  const starter = fixture()
  const root = mkdtempSync(join(tmpdir(), "voyant-standard-node-repository-"))
  roots.push(root)
  const artifact = join(root, "starters/operator/drizzle.schemas.generated.ts")
  mkdirSync(dirname(artifact), { recursive: true })
  writeFileSync(artifact, "export const schema = []\n")
  assert.throws(
    () => run(starter, root),
    (error) =>
      String(error.stderr).includes(
        "checked-in starter must not own database artifact starters/operator/drizzle.schemas.generated.ts",
      ),
  )
})

test("rejects restored checked-in starter compatibility authority", () => {
  for (const relativePath of [
    "starters/operator/src/api/lib/catalog-context.ts",
    "starters/operator/src/api/runtime/payment-config.ts",
    "starters/operator/src/api/runtime/booking-payment-policy-runtime.ts",
    "starters/operator/src/api/runtime/media-runtime.ts",
  ]) {
    const starter = fixture()
    const root = mkdtempSync(join(tmpdir(), "voyant-standard-node-repository-"))
    roots.push(root)
    const facade = join(root, relativePath)
    mkdirSync(dirname(facade), { recursive: true })
    writeFileSync(facade, "export const compatibilityAuthority = true\n")
    assert.throws(
      () => run(starter, root),
      (error) =>
        String(error.stderr).includes(
          `checked-in starter authority must stay deleted: ${relativePath}`,
        ),
    )
  }
})

test("rejects restored Catalog operational authority in the checked-in starter", () => {
  for (const relativePath of [
    "starters/operator/scripts/reindex.ts",
    "starters/operator/scripts/sync-sources.ts",
    "starters/operator/scripts/lib/reindex-stale-documents.ts",
    "starters/operator/scripts/lib/typesense-sdk-client.ts",
    "starters/operator/scripts/lib/build-sync-source-registry.ts",
  ]) {
    const starter = fixture()
    const root = mkdtempSync(join(tmpdir(), "voyant-standard-node-repository-"))
    roots.push(root)
    const script = join(root, relativePath)
    mkdirSync(dirname(script), { recursive: true })
    writeFileSync(script, "export const catalogAuthority = true\n")
    assert.throws(
      () => run(starter, root),
      (error) =>
        String(error.stderr).includes(
          `Catalog operational authority must stay package-owned: ${relativePath}`,
        ),
    )
  }
})

function run(starterDir, root = repoRoot) {
  return execFileSync(process.execPath, [checker, "--root", root, "--starter-dir", starterDir], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  })
}

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "voyant-standard-node-starter-"))
  roots.push(root)
  const packageJson = overrides.packageJson ?? {
    scripts: { start: "voyant-operator start" },
    dependencies: {
      "@voyant-travel/framework": "1.0.0",
      "@voyant-travel/operator-runtime": "1.0.0",
    },
    devDependencies: { "@voyant-travel/cli": "1.0.0" },
  }
  const files = {
    ".env.example": "DATABASE_URL=postgresql://localhost/voyant\n",
    "package.json": `${JSON.stringify(packageJson, null, 2)}\n`,
    "src/scripts/seed.ts": 'console.info("Add project seed data here.")\n',
    "voyant.config.ts":
      overrides.config ??
      `import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  deployment: {
    target: "node",
    providers: { database: "postgres" },
  },
})
`,
    ...overrides.extraFiles,
  }
  for (const directory of [
    "src/api/admin",
    "src/api/public",
    "src/admin",
    "src/modules",
    "src/workflows",
    "src/jobs",
    "src/subscribers",
    "src/links",
    "src/scripts",
  ]) {
    mkdirSync(join(root, directory), { recursive: true })
  }
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(root, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, contents)
  }
  return root
}
