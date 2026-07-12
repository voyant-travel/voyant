import { describe, expect, it } from "vitest"

import { createVoyantNodeScheduledJobPlan } from "./node-scheduled-jobs.js"

const jobs = [
  {
    id: "notifications-hourly",
    cron: "0 * * * *",
    description: "Triggers notifications.",
    route: "/__voyant/scheduled",
    module: "notifications",
    workflowId: "notifications.send-due-reminders",
    input: { limit: 10 },
  },
  {
    id: "outbox-drain",
    cron: "*/1 * * * *",
    description: "Drains the outbox.",
    route: "/__voyant/scheduled",
    module: "events",
  },
] as const

describe("createVoyantNodeScheduledJobPlan", () => {
  it("resolves stable ids before legacy cron expressions and preserves graph metadata", () => {
    const plan = createVoyantNodeScheduledJobPlan(jobs)

    expect(plan.resolve({ scheduleId: "notifications-hourly", cron: "*/1 * * * *" })).toEqual(
      jobs[0],
    )
    expect(plan.resolve({ cron: "*/1 * * * *" })).toEqual(jobs[1])
    expect(plan.resolve({ scheduleId: "missing" })).toBeUndefined()
    expect(plan.requireCron("outbox-drain")).toBe("*/1 * * * *")
  })

  it("rejects required standard schedules missing from the graph", () => {
    expect(() => createVoyantNodeScheduledJobPlan(jobs).requireCron("missing")).toThrow(
      'unknown graph scheduled job "missing"',
    )
  })
})
