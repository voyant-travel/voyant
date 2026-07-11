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
const checkerPath = path.join(repoRoot, "scripts/check-flights-runtime-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-flights-authority-"))
  const files = {
    "flights/package.json": JSON.stringify({
      dependencies: { "@voyant-travel/finance": "workspace:^" },
      voyant: { requiresSchemas: ["@voyant-travel/finance"] },
    }),
    "flights/src/voyant.ts":
      'runtimePorts: [requirePort(flightsRuntimePort)]\nrequires: { capabilities: ["finance.payment-sessions"] }\nexport: "createFlightsVoyantRuntime"\n',
    "flights/src/hono.ts":
      'defineGraphRuntimeFactory(({ getPort }) => getPort(flightsRuntimePort))\ncreateOrderPaymentSessions({ targetType: "flight_order" })\n',
    "flights/src/runtime-port.ts": '["resolveAdapter", "startCardPayment"]\n',
    "operator/src/api/composition.ts":
      "export function buildOperatorRuntimePorts() { return { [flightsRuntimePort.id]: provider } }\nfunction createLazyCatalogSearchRuntime() {}\nexport const operatorGraphRuntimeBindings = {}\nfunction resolveOperatorSmartbillOptions() {}\n",
    "operator/src/api/runtime/flights-runtime.ts":
      "export const operatorFlightsRuntime: FlightsRuntime = { resolveAdapter, startCardPayment }\n",
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
      "--flights-root",
      path.join(root, "flights"),
      "--operator-root",
      path.join(root, "operator"),
    ],
    { cwd: root },
  )
}

describe("check-flights-runtime-authority", () => {
  it("accepts package runtime authority with Node-host port wiring", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /check-flights-runtime-authority: OK/)
  })

  it("rejects package-id bindings and compatibility route loaders", async () => {
    const root = await createFixture({
      "operator/src/api/composition.ts":
        'export function buildOperatorRuntimePorts() { return {} }\nfunction createLazyCatalogSearchRuntime() {}\nexport const operatorGraphRuntimeBindings = { "@voyant-travel/flights": legacy }\nfunction resolveOperatorSmartbillOptions() {}\nconst loadFlightAdminRoutes = legacy\n',
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must bind Flights through flightsRuntimePort\.id/)
      assert.match(error.stderr, /must not bind Flights by package id/)
      assert.match(error.stderr, /must not retain the Flights compatibility route loader/)
      return true
    })
  })
})
