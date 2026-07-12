import { describe, expect, it } from "vitest"

import { loadDeploymentGraphArtifacts } from "./deployment-graph-artifacts"
import {
  CHANNEL_PUSH_AVAILABILITY_CRON,
  OUTBOX_DRAIN_CRON,
  resolveCronJobFromJobs,
  resolveOperatorCronJob,
} from "./scheduled-crons"

describe("resolveOperatorCronJob", () => {
  it("resolves stable schedule ids before cron expressions", () => {
    expect(
      resolveOperatorCronJob({
        scheduleId: "channel-push-availability",
        cron: OUTBOX_DRAIN_CRON,
      }),
    ).toMatchObject({
      id: "channel-push-availability",
      cron: CHANNEL_PUSH_AVAILABILITY_CRON,
    })
  })

  it("keeps legacy cron dispatch working", () => {
    expect(resolveOperatorCronJob({ cron: OUTBOX_DRAIN_CRON })).toMatchObject({
      id: "outbox-drain",
      cron: OUTBOX_DRAIN_CRON,
    })
  })

  it("returns undefined for unknown schedule dispatch keys", () => {
    expect(resolveOperatorCronJob({ scheduleId: "missing-job" })).toBeUndefined()
    expect(resolveOperatorCronJob({ cron: "1 2 3 4 5" })).toBeUndefined()
  })

  it("preserves graph workflow schedule dispatch metadata", () => {
    expect(
      resolveCronJobFromJobs(
        { scheduleId: "@voyant-travel/operator#schedule.notifications.hourly" },
        [
          {
            id: "@voyant-travel/operator#schedule.notifications.hourly",
            cron: "0 * * * *",
            description: "Triggers notifications.",
            route: "/__voyant/scheduled",
            module: "operator",
            workflowId: "notifications.send-due-reminders",
            input: { now: "2026-07-10T05:30:00.000Z" },
          },
        ],
      ),
    ).toEqual({
      id: "@voyant-travel/operator#schedule.notifications.hourly",
      cron: "0 * * * *",
      description: "Triggers notifications.",
      route: "/__voyant/scheduled",
      module: "operator",
      workflowId: "notifications.send-due-reminders",
      input: { now: "2026-07-10T05:30:00.000Z" },
    })
  })

  it("can dispatch every graph-derived scheduled job", () => {
    const graph = loadDeploymentGraphArtifacts()

    for (const job of graph.scheduledJobs) {
      expect(resolveOperatorCronJob({ scheduleId: job.id })).toMatchObject({
        id: job.id,
        cron: job.cron,
      })
    }
  })
})
