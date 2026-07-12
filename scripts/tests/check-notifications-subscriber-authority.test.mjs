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

const manifest = `
eventType: "booking.contract.generated"
export: "notificationsBookingConfirmationAutoDispatchSubscriber"
eventType: "booking.confirmed"
export: "notificationsBookingConfirmedReminderSubscriber"
eventType: "payment.completed"
export: "notificationsPaymentCompletedReminderSubscriber"
eventType: "booking.fully-paid"
export: "notificationsBookingFullyPaidDocumentLifecycleSubscriber"
eventType: "booking.cancelled"
export: "notificationsBookingCancelledReminderSubscriber"
eventType: "booking.expired"
export: "notificationsBookingExpiredReminderSubscriber"
`

const subscriberRuntime = `
export const notificationsBookingConfirmationAutoDispatchSubscriber = factory()
export const notificationsBookingConfirmedReminderSubscriber = factory()
export const notificationsPaymentCompletedReminderSubscriber = factory()
export const notificationsBookingFullyPaidDocumentLifecycleSubscriber = factory()
export const notificationsBookingCancelledReminderSubscriber = factory()
export const notificationsBookingExpiredReminderSubscriber = factory()
eventBus.subscribe("booking.confirmed", handler)
eventBus.subscribe("payment.completed", handler)
eventBus.subscribe(BOOKING_FULLY_PAID_EVENT, handler)
eventBus.emit(BOOKING_FULLY_PAID_EVENT, payload, { category: "domain", source: "subscriber" })
runDocumentBundleLifecycle(runtime, bindings, eventBus, { trigger: "booking.confirmed" })
runDocumentBundleLifecycle(runtime, bindings, eventBus, { trigger: BOOKING_FULLY_PAID_EVENT })
`

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-notifications-authority-"))
  const files = {
    "packages/notifications/src/voyant.ts": manifest,
    "packages/notifications/src/index.ts":
      "const runtime = { documentBundleLifecycle: provider.documentBundleLifecycle }\n",
    "packages/notifications/src/subscriber-runtime.ts": subscriberRuntime,
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
  it("accepts package-owned lifecycle subscriber authority", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /0 hidden bootstrap subscriptions/)
    assert.match(result.stdout, /0 duplicate lifecycle subscriptions/)
  })

  it("rejects hidden module bootstrap subscriptions", async () => {
    const root = await createFixture({
      "packages/notifications/src/index.ts": `
const runtime = { documentBundleLifecycle: provider.documentBundleLifecycle }
eventBus.subscribe("booking.confirmed", handler)
`,
    })
    await assert.rejects(runChecker(root), /must not hide eventBus subscriptions/)
  })

  it("rejects an activated subscriber missing from the manifest", async () => {
    const root = await createFixture({
      "packages/notifications/src/voyant.ts": manifest.replace(
        'export: "notificationsBookingFullyPaidDocumentLifecycleSubscriber"',
        "",
      ),
    })
    await assert.rejects(runChecker(root), /must activate.*exactly once/)
  })

  it("rejects duplicate lifecycle subscriptions", async () => {
    const root = await createFixture({
      "packages/notifications/src/subscriber-runtime.ts": `${subscriberRuntime}
eventBus.subscribe("payment.completed", duplicateHandler)
`,
    })
    await assert.rejects(runChecker(root), /payment.completed exactly once \(found 2\)/)
  })
})
