import type { WorkflowDriver } from "@voyant-travel/workflows/driver"
import { describe, expect, it, vi } from "vitest"
import {
  type GraphWorkflowScheduledJob,
  isGraphWorkflowScheduledJob,
  runScheduledWorkflow,
} from "./workflow-scheduled"

describe("runScheduledWorkflow", () => {
  it("triggers graph workflow schedules through the operator workflow driver", async () => {
    const loadWorkflowRuntime = vi.fn()
    const registerManifestCalls: Parameters<WorkflowDriver["registerManifest"]>[] = []
    const triggerCalls: unknown[][] = []
    const driver = {
      async registerManifest(...args) {
        registerManifestCalls.push(args)
        return { versionId: args[0].manifest.versionId }
      },
      async trigger(workflowId, ...args) {
        triggerCalls.push([workflowId, ...args])
        return {
          id: "run_1",
          workflowId: String(workflowId),
          status: "queued",
          startedAt: 1,
        }
      },
      ingestEvent: vi.fn(),
      getManifest: vi.fn(),
    } satisfies WorkflowDriver
    const job: GraphWorkflowScheduledJob = {
      id: "@voyant-travel/operator#schedule.notifications.send-due-reminders.hourly",
      cron: "0 * * * *",
      description: "Triggers due reminders.",
      route: "/__voyant/scheduled",
      module: "operator",
      workflowId: "notifications.send-due-reminders",
      input: { now: "2026-07-10T05:30:00.000Z" },
    }

    await runScheduledWorkflow(
      job,
      {
        scheduleId: job.id,
        cron: job.cron,
        scheduledTime: Date.parse("2026-07-10T05:30:45.000Z"),
      },
      {
        VOYANT_CLOUD_APP_SLUG: "operator",
        VOYANT_CLOUD_ENVIRONMENT: "production",
      } as AppBindings,
      {
        loadWorkflowRuntime: async (runtimeEnv) => {
          loadWorkflowRuntime(runtimeEnv)
          const workflow = {
            id: "notifications.send-due-reminders",
            config: {
              id: "notifications.send-due-reminders",
              defaultRuntime: "node" as const,
              schedule: { cron: "0 * * * *" },
              async run() {
                return {}
              },
            },
          }
          return {
            workflows: [workflow],
            eventFilters: [],
            workflowResolver: {
              resolve: (workflowId) => (workflowId === workflow.id ? workflow : undefined),
            },
            services: {
              resolve(name) {
                throw new Error(`Unexpected service: ${name}`)
              },
              has: () => false,
            },
          }
        },
        createWorkflowDriver: () => () => driver,
      },
    )

    expect(loadWorkflowRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ VOYANT_CLOUD_APP_SLUG: "operator" }),
    )
    expect(registerManifestCalls).toEqual([
      [
        {
          environment: "production",
          manifest: expect.objectContaining({
            projectId: "operator",
            workflows: [
              expect.objectContaining({
                id: "notifications.send-due-reminders",
              }),
            ],
          }),
        },
      ],
    ])
    expect(triggerCalls).toEqual([
      [
        "notifications.send-due-reminders",
        { now: "2026-07-10T05:30:00.000Z" },
        {
          environment: "production",
          idempotencyKey:
            "scheduled:@voyant-travel/operator#schedule.notifications.send-due-reminders.hourly:1783661445000",
          tags: [
            "scheduled",
            "schedule:@voyant-travel/operator#schedule.notifications.send-due-reminders.hourly",
          ],
        },
      ],
    ])
  })

  it("detects graph workflow schedule jobs by workflowId", () => {
    expect(
      isGraphWorkflowScheduledJob({
        id: "hourly",
        cron: "0 * * * *",
        description: "Hourly",
        route: "/__voyant/scheduled",
        module: "operator",
        workflowId: "workflow.hourly",
      }),
    ).toBe(true)
    expect(
      isGraphWorkflowScheduledJob({
        id: "outbox-drain",
        cron: "*/2 * * * *",
        description: "Outbox",
        route: "/__voyant/scheduled",
        module: "framework",
      }),
    ).toBe(false)
  })
})
