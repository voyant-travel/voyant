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
const checker = path.join(repoRoot, "scripts/check-notifications-subscriber-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-notifications-authority-"))
  const files = {
    "packages/notifications/src/voyant.ts": `
runtimePorts: [requirePort(notificationsRuntimePort)]
subscriber.booking-confirmation-auto-dispatch
subscriber.reminder-booking-confirmed
subscriber.reminder-payment-completed
subscriber.reminder-booking-cancelled
subscriber.reminder-booking-expired
`,
    "packages/notifications/src/index.ts": "export const selectedGraphOnly = true\n",
    "packages/framework/src/operator-distribution.ts":
      'resolve: "@voyant-travel/notifications/reminder-subscribers-extension"\n',
    "starters/operator/src/api/runtime/deployment-resources.ts":
      "const ports = { [notificationsRuntimePort.id]: createOperatorNotificationsRuntimeProvider() }\n",
    "starters/operator/src/api/runtime/notifications-runtime.ts": `
function createOperatorNotificationsRuntimeProvider() {
  return { resolveProviders: providers, resolveDb: db, resolveReminderWorkflowRuntime: workflow }
}
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

const runChecker = (root) => execFileAsync(process.execPath, [checker, "--root", root])

describe("Notifications subscriber authority checker", () => {
  it("accepts selected graph authority through the typed host port", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /Notifications subscriber authority: OK/)
  })

  it("rejects package-id Operator bindings", async () => {
    const root = await createFixture({
      "starters/operator/src/api/runtime/deployment-resources.ts": `
const ports = { [notificationsRuntimePort.id]: createOperatorNotificationsRuntimeProvider() }
const bindings = { "@voyant-travel/notifications": configure }
`,
    })
    await assert.rejects(runChecker(root), /must not bind Notifications by package id/)
  })

  it("rejects compatibility subscriber registration in module bootstrap", async () => {
    const root = await createFixture({
      "packages/notifications/src/index.ts":
        "createBookingConfirmationAutoDispatchSubscriberRuntime().register(context)\n",
    })
    await assert.rejects(runChecker(root), /must not register selected-graph subscribers/)
  })
})
