import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationTaskEnv, NotificationTaskRuntimeOptions } from "./task-runtime.js"

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

export const NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY =
  "notifications.workflows.reminders.runtime" as const

export interface NotificationReminderWorkflowRuntime {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveEnv: () => NotificationTaskEnv | Promise<NotificationTaskEnv>
  resolveRuntimeOptions: (
    env: NotificationTaskEnv,
  ) => NotificationTaskRuntimeOptions | Promise<NotificationTaskRuntimeOptions>
}

/** Build the package-owned reminder runtime from deployment host capabilities. */
export function createNotificationReminderWorkflowRuntime(
  runtime: NotificationReminderWorkflowRuntime,
): NotificationReminderWorkflowRuntime {
  return runtime
}
