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
      'export { relationshipsMiceRuntimePort, relationshipsRouteRuntimePort } from "./runtime-port.js"\nrequirePort(customFieldsRuntimePort)\nrequirePort(relationshipsRouteRuntimePort)\nexport: "createRelationshipsVoyantRuntime"\n',
    "relationships/src/index.ts":
      "createRelationshipsVoyantRuntime = defineGraphRuntimeFactory(({ getPort }) => getPort(relationshipsRouteRuntimePort))\n",
    "relationships/src/runtime-port.ts":
      'definePort<RelationshipsRouteRuntimeOptions>({ id: "relationships.route-runtime" })\ndefinePort<RelationshipsMiceRuntime>({ id: "relationships.mice.runtime" })\n',
    "relationships/src/runtime-contributor.ts":
      "customFieldsRuntimePort\n[customFieldValueReaderRuntimePort.id]\nresolveRegistry\nresolveVisibleValues\n[relationshipsMiceRuntimePort.id]\n",
    "custom-fields/src/runtime-contributor.ts":
      "loadCustomFieldRegistry\n[customFieldsRuntimePort.id]\nresolveRegistry:\nresolveVisibleValues\n",
    "runtime/src/deployment-resources.ts":
      "function createDeploymentPortResources() { return options.createRuntimePorts({ primitives }) }\n",
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
      "--composition",
      path.join(root, "runtime/src/deployment-resources.ts"),
      "--retired-adapter",
      path.join(root, "operator/src/api/runtime/runtime-adapter.ts"),
      "--relationships-root",
      path.join(root, "relationships"),
      "--custom-fields-root",
      path.join(root, "custom-fields"),
    ],
    { cwd: root },
  )
}

describe("check-relationships-runtime-authority", () => {
  it("accepts package factory authority with generic Node port wiring", async () => {
    const result = await runChecker(await createFixture())

    assert.match(result.stdout, /check-relationships-runtime-authority: OK/)
  })

  it("accepts provider-neutral graph ports in generic Node wiring", async () => {
    const result = await runChecker(
      await createFixture({
        "runtime/src/deployment-resources.ts": `
          providerPorts?: VoyantGraphRuntimePorts
          return options.createRuntimePorts({
            primitives,
            ...(options.providerPorts ? { runtimePorts: options.providerPorts } : {}),
          })
        `,
      }),
    )

    assert.match(result.stdout, /check-relationships-runtime-authority: OK/)
  })

  it("rejects package-id binding and the compatibility module export", async () => {
    const root = await createFixture({
      "relationships/src/index.ts":
        "export const relationshipsApiModule = createRelationshipsApiModule()\n",
      "runtime/src/deployment-resources.ts":
        'function createDeploymentPortResources() { return options.createRuntimePorts({ primitives }) }\nexport const operatorGraphRuntimeBindings = { "@voyant-travel/relationships": factory }\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must adapt its graph runtime factory through its typed port/)
      assert.match(error.stderr, /must not retain the preconfigured compatibility module export/)
      assert.match(error.stderr, /compatibility runtime bindings must stay deleted/)
      return true
    })
  })

  it("rejects host-config custom-field authority", async () => {
    const root = await createFixture({
      "relationships/src/runtime-contributor.ts":
        'host.primitives.config.read(db, "customFields")\n[relationshipsMiceRuntimePort.id]\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /database-backed custom-field values/)
      return true
    })
  })

  it("rejects generic definition runtime authority outside custom-fields", async () => {
    const root = await createFixture({
      "custom-fields/src/runtime-contributor.ts": "resolveVisibleValues\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /Generic custom-fields must own/)
      return true
    })
  })
})
