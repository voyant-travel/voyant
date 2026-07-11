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
const checker = path.join(repoRoot, "scripts/check-trips-subscriber-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-trips-subscriber-authority-"))
  const files = {
    "packages/trips/src/voyant.ts": `subscribers: [{ runtime: { entry: "./payment-subscribers", export: "tripsPaymentCompletedSubscriber" } }]`,
    "starters/operator/src/api/app.ts": "export const app = {}\n",
    "starters/operator/src/api/runtime/trips-runtime.ts":
      "export function createOperatorTripsRoutesOptions() {}\n",
    "starters/operator/src/api/composition.ts": `
const providers = { withDb: (bindings, operation) => withDbFromEnv(bindings as AppBindings, operation) }
return withModuleRuntimeService(configured, () => {
  const runtime = { withDb: (operation) => capabilities.withDb(bindings, operation) }
  container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, runtime)
})
`,
    ...overrides,
  }
  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, source)
  }
  return root
}

async function runChecker(root) {
  return execFileAsync(process.execPath, [checker, "--root", root])
}

describe("Trips subscriber authority checker", () => {
  it("accepts graph-owned subscriber registration with only a DB service adapter", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /Trips subscriber authority: OK/)
  })

  it("rejects a central Operator bundle", async () => {
    const root = await createFixture({
      "starters/operator/src/api/app.ts": "plugins: [tripsPaymentBundle]\n",
    })
    await assert.rejects(
      runChecker(root),
      /must not list a central Trips payment subscriber bundle/,
    )
  })

  it("rejects a central Operator subscriber implementation", async () => {
    const root = await createFixture({
      "starters/operator/src/api/runtime/trips-runtime.ts": `
eventBus.subscribe("payment.completed", handler)
`,
    })
    await assert.rejects(runChecker(root), /must not implement payment subscriber authority/)
  })

  it("rejects manual descriptor registration in composition", async () => {
    const root = await createFixture({
      "starters/operator/src/api/composition.ts": `
const providers = { withDb: (bindings, operation) => withDbFromEnv(bindings as AppBindings, operation) }
return withModuleRuntimeService(configured, () => {
  const runtime = { withDb: (operation) => capabilities.withDb(bindings, operation) }
  container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, runtime)
  tripsPaymentCompletedSubscriber.register(context)
})
`,
    })
    await assert.rejects(runChecker(root), /must leave subscriber registration to selected-graph/)
  })
})
