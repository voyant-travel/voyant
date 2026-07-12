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
const checkerPath = path.join(repoRoot, "scripts/check-relationships-runtime-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-relationships-runtime-authority-"))
  const files = {
    "relationships/src/voyant.ts":
      'export { relationshipsRouteRuntimePort } from "./runtime-port.js"\nruntimePorts: [requirePort(relationshipsRouteRuntimePort)]\nexport: "createRelationshipsVoyantRuntime"\n',
    "relationships/src/index.ts":
      "createRelationshipsVoyantRuntime = defineGraphRuntimeFactory(({ getPort }) => getPort(relationshipsRouteRuntimePort))\n",
    "relationships/src/runtime-port.ts":
      'definePort<RelationshipsRouteRuntimeOptions>({ id: "relationships.route-runtime" })\n',
    "operator/src/api/composition.ts":
      'import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"\nexport function buildOperatorRuntimePorts() { return { [relationshipsRouteRuntimePort.id]: {} } }\nfunction createLazyCatalogSearchRuntime() {}\n',
    ...overrides,
  }
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
      "--operator-root",
      path.join(root, "operator"),
      "--relationships-root",
      path.join(root, "relationships"),
    ],
    { cwd: root },
  )
}

describe("check-relationships-runtime-authority", () => {
  it("accepts package factory authority with generic Node port wiring", async () => {
    const result = await runChecker(await createFixture())

    assert.match(result.stdout, /check-relationships-runtime-authority: OK/)
  })

  it("rejects package-id binding and the compatibility module export", async () => {
    const root = await createFixture({
      "relationships/src/index.ts":
        "export const relationshipsHonoModule = createRelationshipsHonoModule()\n",
      "operator/src/api/composition.ts":
        'import { relationshipsRouteRuntimePort } from "@voyant-travel/relationships/voyant"\nexport function buildOperatorRuntimePorts() { return { [relationshipsRouteRuntimePort.id]: {} } }\nfunction createLazyCatalogSearchRuntime() {}\nexport const operatorGraphRuntimeBindings = { "@voyant-travel/relationships": factory }\nfunction bindingsFromModuleFactories() {}\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must adapt its graph runtime factory through its typed port/)
      assert.match(error.stderr, /must not retain the preconfigured compatibility module export/)
      assert.match(error.stderr, /compatibility runtime bindings must stay deleted/)
      return true
    })
  })
})
