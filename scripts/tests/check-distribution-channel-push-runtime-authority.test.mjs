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
      'import { distributionChannelPushVoyantExtensionDefinition } from "./voyant-extensions.js"\n',
    "distribution/src/voyant-extensions.ts":
      'runtimePorts: [requirePort(channelPushRuntimePort)]\nexport: "createChannelPushVoyantRuntime"\n',
    "distribution/src/channel-push/extension.ts":
      "defineGraphRuntimeFactory(({ getPort }) => { getPort(channelPushRuntimePort); runtime.registerSubscriberRuntime(context) })\n",
    "distribution/src/channel-push/runtime-port.ts":
      'id: "distribution.channel-push-runtime"\nresolveRegistry\nregisterSubscriberRuntime\nwithDeps\n',
    "distribution/package.json":
      '{\n  "name": "@voyant-travel/distribution",\n  "exports": { "./runtime-contributor": "./src/runtime-contributor.ts" },\n  "voyant": { "runtime": { "export": "createDistributionRuntimePortContribution" } }\n}\n',
    "distribution/src/runtime-contributor.ts":
      "Promise.resolve()\nhost.getRuntimePort(catalogRuntimeServicesPort)\ncreateDistributionRuntime(host.primitives, services)\n[channelPushRuntimePort.id]: channelPushRuntime\n[catalogDistributionRuntimeExtensionPort.id]\n[financeDistributionPaymentPolicyRuntimePort.id]\n",
    "distribution/src/runtime.ts":
      "catalogRuntime.getSourceRegistryFromContext\nprimitives.database.resolve\nwithDeps\n",
    "runtime/src/deployment-resources.ts": "options.createRuntimePorts({ primitives })\n",
    "operator/src/api/runtime/operator-workflow-services.ts": "",
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
      "--composition",
      path.join(root, "runtime/src/deployment-resources.ts"),
      "--deployment-graph-checker",
      path.join(root, "scripts/check-deployment-graph.ts"),
    ],
    { cwd: root },
  )
}

describe("check-distribution-channel-push-runtime-authority", () => {
  it("accepts a package-owned runtime without an Operator forwarder", async () => {
    const result = await runChecker(await createFixture())

    assert.match(result.stdout, /check-distribution-channel-push-runtime-authority: OK/)
  })

  it("rejects a split extension manifest without its runtime dependency", async () => {
    const root = await createFixture({
      "distribution/src/voyant-extensions.ts": 'export: "createChannelPushVoyantRuntime"\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must declare the channel-push runtime port and factory/)
      return true
    })
  })

  it("rejects an eager Catalog lookup that can race Distribution extension registration", async () => {
    const root = await createFixture({
      "distribution/src/runtime-contributor.ts":
        "host.getRuntimePort(catalogRuntimeServicesPort)\ncreateDistributionRuntime(host.primitives, services)\n[channelPushRuntimePort.id]: channelPushRuntime\n[catalogDistributionRuntimeExtensionPort.id]\n[financeDistributionPaymentPolicyRuntimePort.id]\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must synchronously provide extensions and defer/)
      return true
    })
  })

  it("rejects a package-id binding and restored compatibility route", async () => {
    const root = await createFixture({
      "runtime/src/deployment-resources.ts":
        'const binding = { "@voyant-travel/distribution#channel-push-extension": createChannelPushExtension }\n',
      "operator/src/api/routes/channel-push.ts": "export const compatibilityRoute = true\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must bind Distribution through generated contributor composition/)
      assert.match(
        error.stderr,
        /must not restore channel-push compatibility binding or loader authority/,
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

  it("rejects restoration of the retired Operator workflow services", async () => {
    const root = await createFixture({
      "operator/src/api/runtime/operator-workflow-services.ts":
        "createChannelPushWorkflowRuntimeEntries\nexport async function registerDistributionWorkflowService() {}\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must not restore retired workflow-service composition/)
      return true
    })
  })
})
