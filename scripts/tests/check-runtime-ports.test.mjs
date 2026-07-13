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
const checkerPath = path.join(repoRoot, "scripts/check-runtime-ports.mjs")
async function createFixture({
  appExtra = "",
  composition = false,
  framework = false,
  assignedResources = false,
  retiredResources = false,
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-package-authority-"))
  const app = path.join(root, "operator/src/api/app.ts")
  const adapter = path.join(root, "operator/src/api/runtime/runtime-adapter.ts")
  const resources = path.join(root, "runtime/src/deployment-resources.ts")
  const frameworkFile = path.join(root, "framework/src/composition-lazy.ts")
  await mkdir(path.dirname(adapter), { recursive: true })
  await mkdir(path.dirname(resources), { recursive: true })
  await mkdir(path.dirname(frameworkFile), { recursive: true })
  await writeFile(
    app,
    assignedResources
      ? `const deploymentResources = createOperatorRuntimeDeploymentResources(createGeneratedGraphRuntimePorts)\nconst graphComposition = composeVoyantGraphRuntime({ runtime: graphRuntime, ...deploymentResources })\n${appExtra}\n`
      : `const graphComposition = composeVoyantGraphRuntime({ runtime: graphRuntime, ...createOperatorRuntimeDeploymentResources(createGeneratedGraphRuntimePorts) })\n${appExtra}\n`,
  )
  await writeFile(resources, "export function createVoyantDeploymentResources() { return {} }\n")
  await writeFile(adapter, "export function createOperatorRuntimeDeploymentResources() {}\n")
  if (retiredResources) {
    await writeFile(
      path.join(root, "operator/src/api/runtime/deployment-resources.ts"),
      "export {}\n",
    )
  }
  if (composition)
    await writeFile(path.join(root, "operator/src/api/composition.ts"), "export {}\n")
  if (framework) await writeFile(frameworkFile, "export const registry = {}\n")
  return root
}

function runChecker(root) {
  return execFileAsync(
    process.execPath,
    [
      checkerPath,
      "--operator-root",
      path.join(root, "operator"),
      "--framework-root",
      path.join(root, "framework"),
      "--runtime-root",
      path.join(root, "runtime"),
    ],
    { cwd: root },
  )
}

describe("check-runtime-ports", () => {
  it("accepts the opaque deployment-resource composition boundary", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /0 product runtime-port entries in app composition/)
  })

  it("accepts an assigned deployment-resource composition boundary", async () => {
    const result = await runChecker(await createFixture({ assignedResources: true }))
    assert.match(result.stdout, /0 product runtime-port entries in app composition/)
  })

  it("rejects restored Operator composition and framework factories", async () => {
    const root = await createFixture({
      appExtra: "const buildOperatorRuntimePorts = () => ({})",
      composition: true,
      framework: true,
      retiredResources: true,
    })
    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /composition\.ts must stay deleted/)
      assert.match(error.stderr, /deployment-resources\.ts must stay deleted/)
      assert.match(error.stderr, /buildOperatorRuntimePorts must stay out/)
      assert.match(error.stderr, /composition-lazy\.ts must stay deleted/)
      return true
    })
  })
})
