import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checker = path.join(repoRoot, "scripts/check-operator-runtime-binding-final.mjs")
const contributors = {
  "action-ledger": "host.capabilities.loadActionLedgerHealthRuntime()",
  bookings: "bookings: { options: {} }",
  catalog: "buildCatalogTypesenseIndexer",
  commerce: "host.capabilities.loadCommerceRuntime()",
  distribution: "host.capabilities.loadDistributionChannelPushRuntime()",
  finance: "host.primitives.storage.downloadUrl",
  inventory: "host.capabilities.loadInventoryRuntime()",
  legal: "host.capabilities.loadLegalRuntime()",
  "workflow-runs": "host.capabilities.resolveWorkflowRunnerRegistry()",
}

async function fixture(generatedArguments) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-runtime-binding-final-"))
  const files = {
    "starters/operator/src/api/runtime/deployment-resources.ts": `
return createGeneratedGraphRuntimePorts({
${generatedArguments}
  // resolveDatabase resolveConfig resolveDocumentStorage
})
`,
    ...Object.fromEntries(
      Object.entries(contributors).map(([packageName, source]) => [
        `packages/${packageName}/src/runtime-contributor.ts`,
        source,
      ]),
    ),
  }
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const target = path.join(root, relativePath)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, contents)
    }),
  )
  return root
}

it("accepts package-owned defaults, generic primitives, and the irreducible SmartBill host", async () => {
  const root = await fixture(
    "    capabilities,\n    primitives,\n    host: operatorSmartbillRuntimeHost,",
  )
  const result = await execFileAsync(process.execPath, [checker, "--root", root])
  assert.match(result.stdout, /3 package-owned primitive families/)
})

it("rejects a package-specific generated runtime argument", async () => {
  const root = await fixture(
    "    capabilities,\n    primitives,\n    finance: loadFinanceRuntime(),\n    host: operatorSmartbillRuntimeHost,",
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /keys must be exactly capabilities,primitives,host/,
  )
})
