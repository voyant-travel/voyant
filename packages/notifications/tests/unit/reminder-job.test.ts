import { describe, expect, it, vi } from "vitest"

const { drainDurableNotificationSends, sendDueNotificationReminders } = vi.hoisted(() => ({
  drainDurableNotificationSends: vi.fn(async () => ({
    claimed: 0,
    sent: 0,
    retried: 0,
    deadLettered: 0,
  })),
  sendDueNotificationReminders: vi.fn(async () => ({
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  })),
}))
vi.mock("../../src/tasks/send-due-reminders.js", () => ({ sendDueNotificationReminders }))
vi.mock("../../src/service-durable-send.js", () => ({ drainDurableNotificationSends }))

import {
  runDueNotificationRemindersJob,
  runDueNotificationSendsJob,
} from "../../src/reminder-job.js"

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

  it("exports a fixed durable-send job that resolves deployment providers", async () => {
    const db = {}
    const env = { DATABASE_URL: "postgres://test" }
    const providers = [{ name: "durable-provider" }]
    await runDueNotificationSendsJob({
      getPort: async () => ({
        resolveDb: async () => db,
        resolveEnv: async () => env,
        resolveRuntimeOptions: async () => ({ providers }),
      }),
    } as never)
    expect(drainDurableNotificationSends).toHaveBeenCalledWith(db, providers)
  })
})
