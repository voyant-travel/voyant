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
const checker = path.join(repoRoot, "scripts/check-generated-runtime-contributor-authority.mjs")
const packageFactories = {
  "action-ledger-node": "createActionLedgerNodeRuntimePortContribution",
  auth: "createAuthRuntimePortContribution",
  "bookings-node": "createBookingsNodeRuntimePortContribution",
  "catalog-node": "createCatalogNodeRuntimePortContribution",
  commerce: "createCommerceRuntimePortContribution",
  "distribution-node": "createDistributionNodeRuntimePortContribution",
  "finance-node": "createFinanceNodeRuntimePortContribution",
  "flights-node": "createFlightsNodeRuntimePortContribution",
  inventory: "createInventoryRuntimePortContribution",
  "legal-node": "createLegalNodeRuntimePortContribution",
  mice: "createMiceRuntimePortContribution",
  "notifications-node": "createNotificationsNodeRuntimePortContribution",
  "quotes-node": "createQuotesNodeRuntimePortContribution",
  realtime: "createRealtimeRuntimePortContribution",
  relationships: "createRelationshipsRuntimePortContribution",
  storage: "createStorageRuntimePortContribution",
  storefront: "createStorefrontRuntimePortContribution",
  trips: "createTripsRuntimePortContribution",
  "workflow-runs": "createWorkflowRunsRuntimePortContribution",
}

async function write(root, relativePath, contents) {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, contents)
}

async function fixture(deploymentResources) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-generated-contributors-"))
  await write(
    root,
    "starters/operator/src/api/runtime/deployment-resources.ts",
    deploymentResources,
  )
  await write(
    root,
    "starters/operator/src/api/runtime/operator-runtime-adapter.ts",
    "export const operatorSmartbillRuntimeHost = {}\n",
  )
  await write(
    root,
    "packages/framework/src/deployment-artifacts.ts",
    "record.metadata?.runtime\nGENERATED_GRAPH_RUNTIME_CONTRIBUTORS\nGENERATED_GRAPH_RUNTIME_CONTRIBUTOR_SPECIFIERS\nGeneratedGraphRuntimeContributorHost\nParameters<typeof GENERATED_RUNTIME_CONTRIBUTOR_\ncreateGeneratedGraphRuntimePorts\ncontributor.exportName\ncontributor.importEntry\ninput.runtimeEntryOverrides?.[entry]\nas GENERATED_RUNTIME_CONTRIBUTOR_\n",
  )
  await write(
    root,
    "packages/framework/src/runtime-contributors.generated.ts",
    Object.entries(packageFactories)
      .map(
        ([packageName, factory]) =>
          `export { ${factory} } from "@voyant-travel/${packageName}/runtime-contributor"`,
      )
      .join("\n"),
  )
  for (const [packageName, factory] of Object.entries(packageFactories)) {
    await write(
      root,
      `packages/${packageName}/package.json`,
      JSON.stringify({
        exports: { "./runtime-contributor": "./src/runtime-contributor.ts" },
        voyant: {
          runtime: { entry: "./runtime-contributor", export: factory },
        },
      }),
    )
  }
  return root
}

it("accepts generated static contributor composition", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ host })\n")
  const result = await execFileAsync(process.execPath, [checker, "--root", root])
  assert.match(result.stdout, /19 package contributors statically selected/)
})

it("rejects starter contributor enumeration", async () => {
  const root = await fixture(
    'import { createTripsRuntimePortContribution } from "@voyant-travel/trips/runtime-contributor"\nreturn createGeneratedGraphRuntimePorts({ host })\n',
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /must not import package runtime contributors/,
  )
})
