import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { notificationsReminderJobRuntimePort } from "./reminder-job-runtime-port.js"
import { drainDurableNotificationSends } from "./service-durable-send.js"
import { buildNotificationTaskRuntime } from "./task-runtime.js"
import { sendDueNotificationReminders } from "./tasks/send-due-reminders.js"

export { notificationsReminderJobRuntimePort } from "./reminder-job-runtime-port.js"

/** Sweep and deliver reminders whose durable run records are due. */
export async function runDueNotificationRemindersJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(notificationsReminderJobRuntimePort)
  const [db, env] = await Promise.all([runtime.resolveDb(), runtime.resolveEnv()])
  await sendDueNotificationReminders(db, env, {}, await runtime.resolveRuntimeOptions(env))
}

/** Reconcile and deliver package-owned durable notification send operations. */
export async function runDueNotificationSendsJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(notificationsReminderJobRuntimePort)
  const [db, env] = await Promise.all([runtime.resolveDb(), runtime.resolveEnv()])
  const taskRuntime = buildNotificationTaskRuntime(env, await runtime.resolveRuntimeOptions(env))
  await drainDurableNotificationSends(db, taskRuntime.providers)
}
