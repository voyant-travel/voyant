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
const checker = path.join(repoRoot, "scripts/check-operator-capability-runtime-bindings-cut-2.mjs")
const requirements = {
  "catalog-node": "host.primitives.env\nensureBookingEngineRegistry",
  flights: "host.capabilities.loadFlightsRuntime()",
  notifications: "host.capabilities.loadNotificationsRuntime()",
  quotes: "host.capabilities.loadQuoteProposalRuntime()",
  realtime: "host.primitives\ncreateRealtimeStandardNodeRuntime",
  storage: "host.primitives\ncreateStorageStandardNodeRuntime",
  storefront: "host.capabilities.loadStorefrontRuntime()",
  trips: "host.capabilities.createTripsRoutesOptions\nhost.capabilities.withDb",
}

async function fixture(deploymentResources) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-runtime-binding-cut-2-"))
  const files = {
    "starters/operator/src/api/runtime/deployment-resources.ts": deploymentResources,
    ...Object.fromEntries(
      Object.entries(requirements).map(([name, source]) => [
        `packages/${name}/src/runtime-contributor.ts`,
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

it("accepts the second capability-derived binding cut", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ capabilities, host })\n")
  const result = await execFileAsync(process.execPath, [checker, "--root", root])
  assert.match(result.stdout, /8 package-owned families from generic host resources/)
})

it("rejects starter-side assembly of a migrated binding", async () => {
  const root = await fixture(
    "return createGeneratedGraphRuntimePorts({\n    capabilities,\n    flights: runtime,\n  })\n",
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /must not assemble the flights binding/,
  )
})
