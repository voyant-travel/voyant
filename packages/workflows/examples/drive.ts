// Spike driver. Runs the booking-reminder workflow end-to-end through
// the testing harness and prints what happened.
//
//   pnpm --filter @voyant-travel/workflows build
//   pnpm --filter @voyant-travel/workflows build:examples
//   node packages/workflows/examples-dist/drive.js

import { runWorkflowForTest } from "@voyant-travel/workflows/testing"
import { sendBookingReminder } from "./booking-reminder.js"

async function main(): Promise<void> {
  const now = (() => {
    let t = 1_700_000_000_000
    return () => {
      t += 10 // pretend each call advances 10ms
      return t
    }
  })()

  const result = await runWorkflowForTest(
    sendBookingReminder,
    { bookingId: "bk_123", customerEmail: "x@y.com" },
    {
      now,
      waitForEvent: {
        "booking.confirmed": { bookingId: "bk_123" },
      },
    },
  )

  console.log(JSON.stringify(result, null, 2))

  if (result.status !== "completed") {
    process.exitCode = 1
    return
  }

  if (result.invocations < 2) {
    console.error(`expected multiple invocations, got ${result.invocations}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
