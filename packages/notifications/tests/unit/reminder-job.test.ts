import { describe, expect, it, vi } from "vitest"

const { sendDueNotificationReminders } = vi.hoisted(() => ({
  sendDueNotificationReminders: vi.fn(async () => ({
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  })),
}))
vi.mock("../../src/tasks/send-due-reminders.js", () => ({ sendDueNotificationReminders }))

import { runDueNotificationRemindersJob } from "../../src/reminder-job.js"

describe("due reminders job", () => {
  it("polls durable reminder state without accepting a run payload", async () => {
    const db = {}
    const env = { DATABASE_URL: "postgres://test" }
    const options = {}
    await runDueNotificationRemindersJob({
      getPort: async () => ({
        resolveDb: async () => db,
        resolveEnv: async () => env,
        resolveRuntimeOptions: async () => options,
      }),
    } as never)
    expect(sendDueNotificationReminders).toHaveBeenCalledWith(db, env, {}, options)
  })
})
