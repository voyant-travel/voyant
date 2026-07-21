import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { notificationsReminderJobRuntimePort } from "./reminder-job-runtime-port.js"
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
