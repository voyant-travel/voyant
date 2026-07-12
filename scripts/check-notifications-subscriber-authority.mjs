import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const paths = {
  manifest: "packages/notifications/src/voyant.ts",
  module: "packages/notifications/src/index.ts",
  distribution: "packages/framework/src/operator-distribution.ts",
  composition: "starters/operator/src/api/runtime/deployment-resources.ts",
  host: "starters/operator/src/api/runtime/notifications-runtime.ts",
}

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([name, relativePath]) => [
      name,
      await readFile(path.join(repoRoot, relativePath), "utf8"),
    ]),
  ),
)

const failures = []
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}
const rejectMatch = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message)
}

requireMatch(
  sources.manifest,
  /runtimePorts:\s*\[requirePort\(notificationsRuntimePort\)\]/,
  "Notifications manifests must declare their typed runtime port",
)
requireMatch(
  sources.manifest,
  /subscriber\.booking-confirmation-auto-dispatch[\s\S]*subscriber\.reminder-booking-confirmed[\s\S]*subscriber\.reminder-payment-completed[\s\S]*subscriber\.reminder-booking-cancelled[\s\S]*subscriber\.reminder-booking-expired/,
  "Notifications manifest must preserve confirmation-first subscriber order",
)
requireMatch(
  sources.distribution,
  /resolve:\s*["']@voyant-travel\/notifications\/reminder-subscribers-extension["']/,
  "Operator distribution must select the Notifications subscriber extension",
)
requireMatch(
  sources.composition,
  /\[notificationsRuntimePort\.id\]:\s*createOperatorNotificationsRuntimeProvider\(\)/,
  "Operator must bind Notifications through its typed runtime port",
)
rejectMatch(
  sources.composition,
  /["']@voyant-travel\/notifications["']\s*:/,
  "Operator must not bind Notifications by package id",
)
requireMatch(
  sources.host,
  /createOperatorNotificationsRuntimeProvider\(\)[\s\S]*resolveProviders:[\s\S]*resolveDb:[\s\S]*resolveReminderWorkflowRuntime:/,
  "Operator must provide the complete generic Notifications Node host contract",
)
rejectMatch(
  sources.module,
  /createBookingConfirmationAutoDispatchSubscriberRuntime\(\)\.register|for\s*\([^)]*notificationsReminderSubscriberRuntimeDescriptors[^)]*\)[\s\S]{0,200}\.register/,
  "Notifications module bootstrap must not register selected-graph subscribers",
)

if (failures.length > 0) {
  console.error("Notifications subscriber authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Notifications subscriber authority: OK")
