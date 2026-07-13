import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checker = path.join(repoRoot, "scripts/check-generated-runtime-contributor-authority.mjs")
const packageFactories = {
  accommodations: "createAccommodationsRuntimePortContribution",
  auth: "createAuthRuntimePortContribution",
  bookings: "createBookingsRuntimePortContribution",
  catalog: "createCatalogRuntimePortContribution",
  charters: "createChartersRuntimePortContribution",
  commerce: "createCommerceRuntimePortContribution",
  cruises: "createCruisesRuntimePortContribution",
  distribution: "createDistributionRuntimePortContribution",
  finance: "createFinanceRuntimePortContribution",
  flights: "createFlightsRuntimePortContribution",
  inventory: "createInventoryRuntimePortContribution",
  legal: "createLegalRuntimePortContribution",
  mice: "createMiceRuntimePortContribution",
  notifications: "createNotificationsRuntimePortContribution",
  "operator-settings": "createOperatorSettingsRuntimePortContribution",
  operations: "createOperationsRuntimePortContribution",
  quotes: "createQuotesRuntimePortContribution",
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
    "packages/operator-runtime/src/deployment-resources.ts",
    "export function createOperatorDeploymentResources() {}\n",
  )
  await write(
    root,
    "starters/operator/src/api/runtime/operator-runtime-adapter.ts",
    deploymentResources,
  )
  await write(
    root,
    "packages/framework/src/deployment-artifacts.ts",
    "record.metadata?.runtime\nGENERATED_GRAPH_RUNTIME_CONTRIBUTORS\nGENERATED_GRAPH_RUNTIME_CONTRIBUTOR_SPECIFIERS\nGENERATED_GRAPH_RUNTIME_MANY_PORT_IDS\nGeneratedGraphRuntimeContributorHost\nParameters<typeof GENERATED_RUNTIME_CONTRIBUTOR_\ncreateGeneratedGraphRuntimePorts\ncontributor.entry\ncontributor.exportName\ncontributor.importEntry\ninput.runtimeEntryOverrides?.[entry]\nas GENERATED_RUNTIME_CONTRIBUTOR_\ngetRuntimePort\ncontributor(contributorHost)\nhas multiple static contributors\nmanyPortIds.has(id) ? [value] : value\n",
  )
  await write(root, "packages/framework/src/project-resolver.ts", "local project overrides only\n")
  await write(root, "scripts/emit-deployment-graph.ts", "local project overrides only\n")
  await write(root, "scripts/generate-framework-bom.mjs", "writeFileSync(PKG, nextPkg)\n")
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
  assert.match(
    result.stdout,
    new RegExp(`${Object.keys(packageFactories).length} package-owned contributors`),
  )
})

it("rejects a restored generated contributor barrel", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ host })\n")
  await write(root, "packages/framework/src/runtime-contributors.generated.ts", "export {}\n")
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /retired generated resolver input/,
  )
})

it("reports a stale contributor package entry", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ host })\n")
  await rm(path.join(root, "packages/trips"), { recursive: true })
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /trips contributor package does not exist/,
  )
})

it("rejects generated runtime catalog consumption by the resolver", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ host })\n")
  await write(
    root,
    "packages/framework/src/project-resolver.ts",
    'import { FRAMEWORK_RUNTIME_PACKAGES } from "./runtime-packages.generated.js"\n',
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /must not consume a generated runtime discovery catalog/,
  )
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
