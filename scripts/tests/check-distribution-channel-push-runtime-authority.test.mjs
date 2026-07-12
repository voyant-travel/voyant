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
const checkerPath = path.join(
  repoRoot,
  "scripts/check-distribution-channel-push-runtime-authority.mjs",
)

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-distribution-runtime-authority-"))
  const files = {
    "distribution/src/voyant.ts":
      'runtimePorts: [requirePort(channelPushRuntimePort)]\nexport: "createChannelPushVoyantRuntime"\n',
    "distribution/src/channel-push/extension.ts":
      "defineGraphRuntimeFactory(({ getPort }) => { getPort(channelPushRuntimePort); runtime.registerWorkflowService(context) })\n",
    "distribution/src/channel-push/runtime-port.ts":
      'id: "distribution.channel-push-runtime"\nresolveRegistry\nregisterWorkflowService\n',
    "operator/src/api/runtime/deployment-resources.ts":
      "export const ports = { [channelPushRuntimePort.id]: operatorChannelPushRuntime }\n",
    "operator/src/api/runtime/channel-push-runtime.ts":
      'import type { ChannelPushRuntime } from "@voyant-travel/distribution"\ngetBookingEngineRegistryFromContext\nregisterDistributionWorkflowService\n',
    "operator/src/api/runtime/operator-workflow-services.ts":
      "createLazyWorkflowDb\nselectedUnitIds.has(OPERATOR_WORKFLOW_RUNTIME_UNIT_IDS.distribution)\n",
    "scripts/check-deployment-graph.ts":
      'const operatorChannelPushRoutePath = join(operatorRoot, "src/api/routes/channel-push.ts")\nif (existsSync(operatorChannelPushRoutePath)) failures.push("deleted")\n',
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
      "--distribution-root",
      path.join(root, "distribution"),
      "--operator-root",
      path.join(root, "operator"),
      "--deployment-graph-checker",
      path.join(root, "scripts/check-deployment-graph.ts"),
    ],
    { cwd: root },
  )
}

describe("check-distribution-channel-push-runtime-authority", () => {
  it("accepts package factory authority with an Operator typed-port provider", async () => {
    const result = await runChecker(await createFixture())

    assert.match(result.stdout, /check-distribution-channel-push-runtime-authority: OK/)
  })

  it("rejects a package-id binding and restored compatibility route", async () => {
    const root = await createFixture({
      "operator/src/api/runtime/deployment-resources.ts":
        'const binding = { "@voyant-travel/distribution#channel-push-extension": createChannelPushExtension }\n',
      "operator/src/api/routes/channel-push.ts": "export const compatibilityRoute = true\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must bind the Distribution channel-push runtime port/)
      assert.match(
        error.stderr,
        /must not restore the channel-push package-id compatibility binding/,
      )
      assert.match(error.stderr, /channel-push\.ts must stay deleted/)
      return true
    })
  })

  it("rejects deployment-graph verification that reads the deleted route", async () => {
    const root = await createFixture({
      "scripts/check-deployment-graph.ts":
        'const operatorChannelPushRoutePath = join(operatorRoot, "src/api/routes/channel-push.ts")\nif (existsSync(operatorChannelPushRoutePath)) readFile(operatorChannelPushRoutePath)\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must not read the deleted channel-push route/)
      return true
    })
  })
})
