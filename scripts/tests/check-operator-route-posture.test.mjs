import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checkerPath = path.join(repoRoot, "scripts/check-operator-route-posture.mjs")

async function createFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-operator-route-posture-"))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
  return root
}

async function runChecker(root) {
  return execFileAsync(
    process.execPath,
    [
      checkerPath,
      "--app",
      path.join(root, "app.ts"),
      "--composition",
      path.join(root, "composition.ts"),
      "--legacy-public-paths",
      path.join(root, "public-paths.ts"),
    ],
    { cwd: root },
  )
}

const validApp = `
mountApp({
  publicPaths: [...graphComposition.routePosture.publicPaths],
  dbTransactionalPaths: [...graphComposition.routePosture.transactionalPaths],
})
`

describe("check-operator-route-posture", () => {
  it("accepts graph-derived posture with only the reviewed adapters", async () => {
    const root = await createFixture({ "app.ts": validApp, "composition.ts": "export {}\n" })

    const result = await runChecker(root)

    assert.match(result.stdout, /check-operator-route-posture: OK/)
  })

  it("rejects legacy lists and package-specific composition overrides", async () => {
    const root = await createFixture({
      "app.ts": `${validApp}\nconst extra = "/v1/public/products"\ndefineLazyHonoBundle({ load: netopiaHonoBundle })\n`,
      "composition.ts": 'export const finance = { anonymous: true, transactionalPaths: ["/"] }\n',
      "public-paths.ts": "export const OPERATOR_PUBLIC_PATHS = []\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /public-paths\.ts must stay deleted/)
      assert.match(error.stderr, /must not contain starter public-path adapters/)
      assert.match(error.stderr, /package-specific anonymous posture/)
      assert.match(error.stderr, /package-specific transactionalPaths posture/)
      assert.match(error.stderr, /graph-owned Netopia route adapter/)
      return true
    })
  })
})
