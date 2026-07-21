import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationTaskEnv, NotificationTaskRuntimeOptions } from "./task-runtime.js"

export interface DeliverReminderJobInput {
  reminderRunId: string
}

export interface DeliverReminderJobOutput {
  reminderRunId: string
  status: string | null
}

export interface SendDueRemindersJobInput {
  now?: string | null
}

export const NOTIFICATION_REMINDER_JOB_RUNTIME_KEY =
  "notifications.jobs.reminders.runtime" as const

export interface NotificationReminderJobRuntime {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolveEnv: () => NotificationTaskEnv | Promise<NotificationTaskEnv>
  resolveRuntimeOptions: (
    env: NotificationTaskEnv,
  ) => NotificationTaskRuntimeOptions | Promise<NotificationTaskRuntimeOptions>
}

/** Build the package-owned reminder runtime from deployment host capabilities. */
export function createNotificationReminderJobRuntime(
  runtime: NotificationReminderJobRuntime,
): NotificationReminderJobRuntime {
  return runtime
}
