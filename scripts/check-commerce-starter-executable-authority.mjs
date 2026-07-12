import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const root = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot

const deletedStarterFiles = [
  "starters/operator/src/api/routes/booking-schedule.ts",
  "starters/operator/src/api/routes/catalog-checkout.ts",
  "starters/operator/src/api/routes/catalog-content.ts",
  "starters/operator/src/api/subscribers/booking-cancellation-settlement.ts",
  "starters/operator/src/api/subscribers/booking-payment-cleanup.ts",
  "starters/operator/src/api/jobs/draft-reaper-scheduled.ts",
  "starters/operator/src/api/jobs/promotion-scheduled.ts",
]

const failures = []
for (const relativePath of deletedStarterFiles) {
  await access(path.join(root, relativePath)).then(
    () => failures.push(`obsolete starter implementation must stay deleted: ${relativePath}`),
    () => undefined,
  )
}

const [catalogManifest, commerceManifest, composition, financeRuntime, notificationsRuntime] =
  await Promise.all(
    [
      "packages/catalog/src/voyant.ts",
      "packages/commerce/src/voyant.ts",
      "starters/operator/src/api/runtime/deployment-resources.ts",
      "packages/finance/src/index.ts",
      "packages/notifications/src/subscriber-runtime.ts",
    ].map((relativePath) => readFile(path.join(root, relativePath), "utf8")),
  )

const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}
const rejectMatch = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message)
}

requireMatch(
  catalogManifest,
  /catalog\.reap-expired-booking-drafts[\s\S]*catalogDraftReaperWorkflow/,
  "Catalog must own the draft-reaper workflow and schedule",
)
requireMatch(
  commerceManifest,
  /commerce\.process-promotion-boundaries[\s\S]*promotionBoundarySchedulerWorkflow/,
  "Commerce must own the promotion-boundary workflow and schedule",
)
requireMatch(
  composition,
  /\[catalogContentRuntimePort\.id\]:\s*\{[\s\S]*resolveRegistry:/,
  "Operator must expose only the shared catalog content registry capability",
)
requireMatch(
  financeRuntime,
  /registerBookingFinancialLifecycle\(context\.container, financeBookingLifecycle\)/,
  "Finance graph runtime must register the booking financial lifecycle",
)
requireMatch(
  notificationsRuntime,
  /skipQueuedBookingPaymentReminders\(db, data\.bookingId, "cancelled"\)[\s\S]*skipQueuedBookingPaymentReminders\(db, data\.bookingId, "expired"\)/,
  "Notifications subscribers must own terminal booking reminder cleanup",
)
rejectMatch(
  composition,
  /["']@voyant-travel\/(?:bookings|catalog|commerce|finance)[^"']*["']\s*:/,
  "Operator composition must not bind commerce/catalog/finance/bookings by package id",
)
rejectMatch(
  composition,
  /routes\/(?:booking-schedule|catalog-checkout|catalog-content)|subscribers\/(?:booking-cancellation-settlement|booking-payment-cleanup)/,
  "Operator composition must not reference migrated starter implementations",
)

if (failures.length > 0) {
  console.error("Commerce starter executable authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log("Commerce starter executable authority: OK")
