import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import { deliverQueuedNotificationReminder } from "./tasks/deliver-reminder.js"
import { sendDueNotificationReminders } from "./tasks/send-due-reminders.js"
import {
  type DeliverReminderWorkflowInput,
  type DeliverReminderWorkflowOutput,
  NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
  type NotificationReminderWorkflowRuntime,
  type SendDueRemindersWorkflowInput,
} from "./workflow-runtime.js"

export type CreateNotificationReminderWorkflowsOptions = NotificationReminderWorkflowRuntime

export const notificationsDeliverReminderWorkflowManifest = {
  id: "notifications.deliver-reminder",
  config: {
    defaultRuntime: "node" as const,
    retry: {
      max: 3,
      backoff: "exponential" as const,
      maxDelay: "300s" as const,
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

export const notificationsDeliverReminderWorkflow = workflow<
  DeliverReminderWorkflowInput,
  DeliverReminderWorkflowOutput
>({
  ...notificationsDeliverReminderWorkflowManifest.config,
  id: notificationsDeliverReminderWorkflowManifest.id,
  async run(input, ctx) {
    return runDeliverReminder(
      ctx.services.resolve<NotificationReminderWorkflowRuntime>(
        NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
      ),
      input,
    )
  },
})

export const notificationsSendDueRemindersWorkflow = workflow<
  SendDueRemindersWorkflowInput,
  Awaited<ReturnType<typeof sendDueNotificationReminders>>
>({
  ...notificationsSendDueRemindersWorkflowManifest.config,
  id: notificationsSendDueRemindersWorkflowManifest.id,
  async run(input, ctx) {
    return runSendDueReminders(
      ctx.services.resolve<NotificationReminderWorkflowRuntime>(
        NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
      ),
      input,
      async (job) => {
        await ctx.invoke(notificationsDeliverReminderWorkflow, job, { detach: true })
      },
    )
  },
})

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
      return runDeliverReminder(options, input)
    },
  })

  const sendDueRemindersWorkflow = workflow<
    SendDueRemindersWorkflowInput,
    Awaited<ReturnType<typeof sendDueNotificationReminders>>
  >({
    ...notificationsSendDueRemindersWorkflowManifest.config,
    id: notificationsSendDueRemindersWorkflowManifest.id,
    async run(input, ctx) {
      return runSendDueReminders(options, input, async (job) => {
        await ctx.invoke(deliverReminderWorkflow, job, { detach: true })
      })
    },
  })

  return { deliverReminderWorkflow, sendDueRemindersWorkflow }
}

async function runDeliverReminder(
  options: NotificationReminderWorkflowRuntime,
  input: DeliverReminderWorkflowInput,
): Promise<DeliverReminderWorkflowOutput> {
  const [db, env] = await Promise.all([options.resolveDb(), options.resolveEnv()])
  return deliverQueuedNotificationReminder(db, env, input, await options.resolveRuntimeOptions(env))
}

async function runSendDueReminders(
  options: NotificationReminderWorkflowRuntime,
  input: SendDueRemindersWorkflowInput,
  enqueueReminderDelivery: (job: DeliverReminderWorkflowInput) => Promise<void>,
): Promise<Awaited<ReturnType<typeof sendDueNotificationReminders>>> {
  const [db, env] = await Promise.all([options.resolveDb(), options.resolveEnv()])
  const runtimeOptions = await options.resolveRuntimeOptions(env)
  return sendDueNotificationReminders(db, env, input, {
    ...runtimeOptions,
    enqueueReminderDelivery,
  })
}

export {
  type DeliverReminderWorkflowInput,
  type DeliverReminderWorkflowOutput,
  NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY,
  type NotificationReminderWorkflowRuntime,
  type SendDueRemindersWorkflowInput,
} from "./workflow-runtime.js"
