import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationTaskEnv, NotificationTaskRuntimeOptions } from "./task-runtime.js"
import { deliverQueuedNotificationReminder } from "./tasks/deliver-reminder.js"
import { sendDueNotificationReminders } from "./tasks/send-due-reminders.js"

export interface DeliverReminderWorkflowInput {
  reminderRunId: string
}

export interface DeliverReminderWorkflowOutput {
  reminderRunId: string
  status: string | null
}

export interface SendDueRemindersWorkflowInput {
  now?: string | null
}

export interface CreateNotificationReminderWorkflowsOptions {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveEnv: () => NotificationTaskEnv | Promise<NotificationTaskEnv>
  resolveRuntimeOptions: (
    env: NotificationTaskEnv,
  ) => NotificationTaskRuntimeOptions | Promise<NotificationTaskRuntimeOptions>
}

export const notificationsDeliverReminderWorkflowManifest = {
  id: "notifications.deliver-reminder",
  config: {
    defaultRuntime: "node" as const,
    retry: {
      max: 3,
      backoff: "exponential" as const,
      maxDelay: "300s",
    },
  },
} satisfies WorkflowDescriptor

export const notificationsSendDueRemindersWorkflowManifest = {
  id: "notifications.send-due-reminders",
  config: {
    defaultRuntime: "node" as const,
    schedule: { cron: "0 * * * *", name: "hourly" },
  },
} satisfies WorkflowDescriptor

/** Register the reminder delivery worker and its hourly enqueueing sweep. */
export function createNotificationReminderWorkflows(
  options: CreateNotificationReminderWorkflowsOptions,
) {
  const deliverReminderWorkflow = workflow<
    DeliverReminderWorkflowInput,
    DeliverReminderWorkflowOutput
  >({
    ...notificationsDeliverReminderWorkflowManifest.config,
    id: notificationsDeliverReminderWorkflowManifest.id,
    async run(input) {
      const [db, env] = await Promise.all([options.resolveDb(), options.resolveEnv()])
      return deliverQueuedNotificationReminder(
        db,
        env,
        input,
        await options.resolveRuntimeOptions(env),
      )
    },
  })

  const sendDueRemindersWorkflow = workflow<
    SendDueRemindersWorkflowInput,
    Awaited<ReturnType<typeof sendDueNotificationReminders>>
  >({
    ...notificationsSendDueRemindersWorkflowManifest.config,
    id: notificationsSendDueRemindersWorkflowManifest.id,
    async run(input, ctx) {
      const [db, env] = await Promise.all([options.resolveDb(), options.resolveEnv()])
      const runtimeOptions = await options.resolveRuntimeOptions(env)
      return sendDueNotificationReminders(db, env, input, {
        ...runtimeOptions,
        enqueueReminderDelivery: async (job) => {
          await ctx.invoke(deliverReminderWorkflow, job, { detach: true })
        },
      })
    },
  })

  return { deliverReminderWorkflow, sendDueRemindersWorkflow }
}
