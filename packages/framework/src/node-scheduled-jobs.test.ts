import { describe, expect, it } from "vitest"
import {
  createVoyantNodeScheduledJobPlan,
  renderGoogleCloudSchedulerScript,
} from "./node-scheduled-jobs.js"

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

describe("renderGoogleCloudSchedulerScript", () => {
  it("renders graph jobs without project-owned provisioning code", () => {
    const script = renderGoogleCloudSchedulerScript(
      [
        {
          id: "@voyant-travel/bookings#schedule.expire-holds",
          cron: "*/5 * * * *",
          description: "Expire stale booking holds",
          route: "/__voyant/scheduled",
          module: "@voyant-travel/bookings",
          workflowId: "bookings.expire-stale-holds",
        },
      ],
      {
        targetUrl: "https://operator.example.test/",
        originTrustSecret: "trust'key",
        location: "europe-west1",
        oidcServiceAccount: "scheduler@example.test",
      },
    )

    expect(script).toContain(
      "gcloud scheduler jobs create http operator-voyant-travel-bookings-schedule-expire-holds",
    )
    expect(script).toContain("--schedule='*/5 * * * *'")
    expect(script).toContain("schedule=%40voyant-travel%2Fbookings%23schedule.expire-holds")
    expect(script).toContain("--location='europe-west1'")
    expect(script).toContain("--oidc-service-account-email='scheduler@example.test'")
    expect(script).toContain("x-voyant-origin-trust=trust'\\''key")
  })

  it("rejects missing deployment-specific secrets", () => {
    expect(() =>
      renderGoogleCloudSchedulerScript([], {
        targetUrl: "https://operator.example.test",
        originTrustSecret: "",
      }),
    ).toThrow("originTrustSecret is required")
  })
})
