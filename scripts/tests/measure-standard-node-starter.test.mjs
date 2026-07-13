import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const probe = join(repoRoot, "scripts/measure-standard-node-starter.mjs")

test("measures a built Node starter without starting a listener", () => {
  const root = mkdtempSync(join(tmpdir(), "voyant-starter-measurement-"))
  try {
    write(root, "starters/operator/package.json", '{"type":"module"}\n')
    write(root, "starters/operator/voyant.config.ts", "export default defineConfig({})\n")
    for (const file of ["env.d.ts", "tsconfig.server.json", "vite.config.ts", "vitest.config.ts"]) {
      write(root, `starters/operator/.voyant/${file}`, "{}\n")
    }
    write(
      root,
      "starters/operator/.voyant/tsconfig.client.json",
      '{"compilerOptions":{"paths":{"@/*":["../src/*"]}}}\n',
    )
    write(root, "starters/operator/dist/server/server.js", "export default { fetch() {} }\n")
    write(root, "starters/operator/dist/client/assets/admin-page.js", "export const page = true\n")

    const output = execFileSync(
      process.execPath,
      [probe, "--root", root, "--require-build", "--check"],
      { cwd: repoRoot, encoding: "utf8" },
    )
    const report = JSON.parse(output)

    assert.equal(report.schemaVersion, "voyant.starter-performance.v2")
    assert.equal(report.metadata.checkedIn.files, 0)
    assert.equal(report.metadata.generated.files, 5)
    assert.equal(report.metadata.generated.declarationPathEntries, 1)
    assert.equal(report.server.files, 1)
    assert.equal(report.admin.files, 1)
    assert.equal(report.boot.ok, true)
    assert.ok(report.boot.milliseconds >= 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function write(root, path, contents) {
  const destination = join(root, path)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
}
