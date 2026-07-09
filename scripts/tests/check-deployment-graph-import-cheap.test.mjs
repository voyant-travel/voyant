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
const checkerPath = path.join(repoRoot, "scripts/check-deployment-graph-import-cheap.mjs")

async function createFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-graph-import-cheap-"))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
  return root
}

async function runChecker(cwd, entry = "manifest:manifest.ts") {
  return execFileAsync(process.execPath, [checkerPath, "--entry", entry], { cwd })
}

describe("check-deployment-graph-import-cheap", () => {
  it("rejects static managed runtime imports from generated metadata entries", async () => {
    const root = await createFixture({
      "manifest.ts": `import { startManagedProfileRuntime } from "@voyant-travel/framework/managed-runtime"

export const GENERATED_DEPLOYMENT_GRAPH_HASH = "sha256:test" as const
void startManagedProfileRuntime
`,
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /deployment-graph-import-cheap:runtime-heavy-import/)
      assert.match(error.stderr, /manifest\.ts imports @voyant-travel\/framework\/managed-runtime/)
      return true
    })
  })

  it("allows managed runtime to stay behind a dynamic import", async () => {
    const root = await createFixture({
      "manifest.ts": `export const GENERATED_DEPLOYMENT_GRAPH_HASH = "sha256:test" as const

export async function start() {
  const { startManagedProfileRuntime } = await import("@voyant-travel/framework/managed-runtime")
  return startManagedProfileRuntime
}
`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /check-deployment-graph-import-cheap: OK/)
  })

  it("allows serializable workflow manifest descriptor imports", async () => {
    const root = await createFixture({
      "manifest.ts": `import { workflowManifest } from "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest"

export const graph = { workflows: [workflowManifest] }
`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /check-deployment-graph-import-cheap: OK/)
  })

  it("rejects transitive route imports from graph declarations", async () => {
    const root = await createFixture({
      "manifest.ts": `import { routes } from "./routes"

export const graph = { routes }
`,
      "routes.ts": `export const routes = []
`,
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /manifest\.ts imports \.\/routes/)
      assert.match(error.stderr, /route graph must stay behind a lazy runtime import/)
      return true
    })
  })
})
