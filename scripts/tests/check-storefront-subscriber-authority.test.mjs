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
const checker = path.join(repoRoot, "scripts/check-storefront-subscriber-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-storefront-subscriber-authority-"))
  const files = {
    "packages/storefront/src/voyant.ts": `
runtime: { entry: "@voyant-travel/storefront", export: "createStorefrontVoyantRuntime" },
runtimePorts: [requirePort(storefrontRuntimePort)],
subscribers: [{ runtime: { entry: "./booking-bootstrap-subscriber", export: "storefrontBookingBootstrapSubscriber" } }]
`,
    "packages/storefront/src/booking-bootstrap-subscriber-runtime.ts": `
export const storefrontBookingBootstrapSubscriber: SubscriberRuntimeDescriptor = {
  register: ({ eventBus }) => {
    eventBus.subscribe(BOOKING_BOOTSTRAP_INTENT_EVENT, async (envelope) => {
      await createBookingBootstrapIntentHandler({ resolveDb: () => db })(envelope)
    })
  }
}
`,
    "packages/storefront/src/index.ts":
      "registerStorefrontBookingBootstrapRuntime(container, runtime)\n",
    "starters/operator/src/api/runtime/deployment-resources.ts": `
[storefrontRuntimePort.id]: createOperatorStorefrontRuntimeProvider(capabilities)
function createOperatorStorefrontRuntimeProvider() {
  return { bookingIntents: { withDb: (bindings, operation) => withDbFromEnv(bindings, operation) } }
}
`,
    "starters/operator/src/api/app.ts": "export const app = {}\n",
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

describe("check-storefront-subscriber-authority", () => {
  it("accepts package-owned selected-graph activation", async () => {
    const root = await createFixture()
    const { stdout } = await runChecker(root)
    assert.match(stdout, /Storefront subscriber authority: OK/)
  })

  it("rejects a missing manifest runtime reference", async () => {
    const root = await createFixture({
      "packages/storefront/src/voyant.ts": "subscribers: []\n",
    })
    await assert.rejects(runChecker(root), /manifest must own the booking-bootstrap subscriber/)
  })

  it("rejects central Storefront module subscription", async () => {
    const root = await createFixture({
      "packages/storefront/src/index.ts": `
registerStorefrontBookingBootstrapRuntime(container, runtime)
eventBus.subscribe("storefront.booking.bootstrap.requested", handler)
`,
    })
    await assert.rejects(runChecker(root), /must not retain manual subscriber authority/)
  })

  it("rejects swallowed infrastructure errors", async () => {
    const root = await createFixture({
      "packages/storefront/src/booking-bootstrap-subscriber-runtime.ts": `
export const storefrontBookingBootstrapSubscriber: SubscriberRuntimeDescriptor = {
  register: ({ eventBus }) => eventBus.subscribe(BOOKING_BOOTSTRAP_INTENT_EVENT, async (envelope) => {
    try { await createBookingBootstrapIntentHandler({ resolveDb: () => db })(envelope) }
    catch (error) { console.error(error) }
  })
}
`,
    })
    await assert.rejects(runChecker(root), /must not swallow infrastructure errors/)
  })
})
