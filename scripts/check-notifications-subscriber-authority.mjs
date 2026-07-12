import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const readSource = (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8")
const [manifest, moduleSource, subscriberRuntime] = await Promise.all([
  readSource("packages/notifications/src/voyant.ts"),
  readSource("packages/notifications/src/index.ts"),
  readSource("packages/notifications/src/subscriber-runtime.ts"),
])

const failures = []
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}
const rejectMatch = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message)
}

rejectMatch(
  moduleSource,
  /eventBus\.subscribe\s*(?:<[^;]+?>)?\s*\(/,
  "Notifications module bootstrap must not hide eventBus subscriptions",
)
requireMatch(
  moduleSource,
  /documentBundleLifecycle:\s*provider\.documentBundleLifecycle/,
  "Notifications selected subscriber runtime must receive the document lifecycle policy",
)

const exportedSubscribers = [
  ...subscriberRuntime.matchAll(/export const (notifications[A-Z]\w+Subscriber)\s*=/g),
].map((match) => match[1])
for (const exportName of exportedSubscribers) {
  const declarations = manifest.match(new RegExp(`export:\\s*["']${exportName}["']`, "g")) ?? []
  if (declarations.length !== 1) {
    failures.push(
      `Notifications manifest must activate ${exportName} exactly once (found ${declarations.length})`,
    )
  }
}

const requiredOwnership = [
  ["booking.confirmed", "notificationsBookingConfirmedReminderSubscriber"],
  ["payment.completed", "notificationsPaymentCompletedReminderSubscriber"],
  ["booking.fully-paid", "notificationsBookingFullyPaidDocumentLifecycleSubscriber"],
]
for (const [eventType, exportName] of requiredOwnership) {
  requireMatch(
    manifest,
    new RegExp(
      `eventType:\\s*["']${eventType.replace(".", "\\.")}["'][\\s\\S]{0,240}export:\\s*["']${exportName}["']`,
    ),
    `Notifications manifest must assign ${eventType} to ${exportName}`,
  )
}

const subscriptionPatterns = new Map([
  ["booking.confirmed", /eventBus\.subscribe(?:<[^>]+>)?\(\s*["']booking\.confirmed["']/g],
  ["payment.completed", /eventBus\.subscribe(?:<[^>]+>)?\(\s*["']payment\.completed["']/g],
  [
    "booking.fully-paid",
    /eventBus\.subscribe(?:<[^>]+>)?\(\s*(?:BOOKING_FULLY_PAID_EVENT|["']booking\.fully-paid["'])/g,
  ],
])
for (const [eventType, pattern] of subscriptionPatterns) {
  const subscriptions = subscriberRuntime.match(pattern) ?? []
  if (subscriptions.length !== 1) {
    failures.push(
      `Notifications subscriber runtime must subscribe to ${eventType} exactly once (found ${subscriptions.length})`,
    )
  }
}

requireMatch(
  subscriberRuntime,
  /eventBus\.emit\(\s*BOOKING_FULLY_PAID_EVENT[\s\S]{0,500}category:\s*["']domain["'][\s\S]{0,80}source:\s*["']subscriber["']/,
  "Notifications payment subscriber must preserve booking.fully-paid domain emission metadata",
)
requireMatch(
  subscriberRuntime,
  /runDocumentBundleLifecycle\([\s\S]{0,220}trigger:\s*["']booking\.confirmed["']/,
  "Notifications booking.confirmed subscriber must preserve document lifecycle handling",
)
requireMatch(
  subscriberRuntime,
  /trigger:\s*BOOKING_FULLY_PAID_EVENT/,
  "Notifications booking.fully-paid subscriber must preserve document lifecycle handling",
)

if (failures.length > 0) {
  console.error("Notifications subscriber authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Notifications subscriber authority: OK (${exportedSubscribers.length} activated descriptors, 0 hidden bootstrap subscriptions, 0 duplicate lifecycle subscriptions)`,
)
