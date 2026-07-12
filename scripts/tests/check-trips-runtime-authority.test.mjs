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
const checkerPath = path.join(repoRoot, "scripts/check-trips-runtime-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-trips-runtime-authority-"))
  const files = {
    "trips/src/voyant.ts":
      'requirePort(tripsRoutesRuntimePort)\nrequirePort(tripsDatabaseRuntimePort)\nconst catalogRuntimeServicesPortReference = { id: "catalog.runtime-services" }\nconst catalogCheckoutApiRuntimePortReference = { id: "commerce.checkout-api-options" }\nconst flightsRuntimePortReference = { id: "flights.runtime" }\ncatalogRuntimeServicesPortReference,\ncatalogCheckoutApiRuntimePortReference,\nflightsRuntimePortReference,\nexport: "createTripsVoyantRuntime"\n',
    "trips/src/index.ts":
      'createTripsVoyantRuntime = defineGraphRuntimeFactory(async ({ api, getPort }) => { api.some(({ surface }) => surface === "admin"); api.some(({ surface }) => surface === "public"); getPort(tripsRoutesRuntimePort); getPort(tripsDatabaseRuntimePort); return { module: { requiresTransactionalDb: true } } })\n',
    "trips/src/runtime-port.ts":
      'definePort<TripsRoutesOptionsProvider>({ id: "trips.routes-runtime" })\ndefinePort<TripsDatabaseRuntime>({ id: "trips.database-runtime" })\n',
    "trips/src/runtime-contributor.ts":
      "host.getRuntimePort(catalogRuntimeServicesPort)\nhost.getRuntimePort(catalogCheckoutApiRuntimePort)\nhost.getRuntimePort(flightsRuntimePort)\nhost.primitives.database.transaction\n",
    "trips/src/runtime.ts": "createTripsRouteRuntime\n",
    "operator/src/api/runtime/deployment-resources.ts":
      "function createDeploymentPortResources() { return createGeneratedGraphRuntimePorts({ primitives }) }\nexport function createOperatorDeploymentResources() {}\n",
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
      "--trips-root",
      path.join(root, "trips"),
    ],
    { cwd: root },
  )
}

describe("check-trips-runtime-authority", () => {
  it("accepts package runtime authority with generic Node ports", async () => {
    const result = await runChecker(await createFixture())

    assert.match(result.stdout, /check-trips-runtime-authority: OK/)
  })

  it("rejects package-id binding and the compatibility module export", async () => {
    const root = await createFixture({
      "trips/src/index.ts": "export const tripsHonoModule = {}\n",
      "operator/src/api/runtime/deployment-resources.ts":
        'function createDeploymentPortResources() { return createGeneratedGraphRuntimePorts({ primitives }) }\nexport function createOperatorDeploymentResources() {}\nexport const operatorGraphRuntimeBindings = { "@voyant-travel/trips": factory }\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must compose its routes and transactional lifecycle/)
      assert.match(error.stderr, /must not retain the preconfigured compatibility module export/)
      assert.match(error.stderr, /compatibility runtime bindings must stay deleted/)
      return true
    })
  })
})
