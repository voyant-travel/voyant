import { getVoyantCloudClient } from "@voyantjs/cloud-sdk"
import { createInMemoryExecutionLockManager } from "@voyantjs/core"
import {
  buildNotificationTaskRuntime,
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
  type NotificationProvider,
  type NotificationTaskRuntimeOptions,
} from "@voyantjs/notifications"

export const resolveNotificationProviders = (
  env: Record<string, unknown>,
): ReadonlyArray<NotificationProvider> => {
  const cloud = getVoyantCloudClient(env)
  const from =
    typeof env.EMAIL_FROM === "string" && env.EMAIL_FROM.length > 0
      ? env.EMAIL_FROM
      : "Voyant <noreply@voyantcloud.app>"
  return [
    createVoyantCloudEmailProvider({ client: cloud, from }),
    createVoyantCloudSmsProvider({ client: cloud }),
  ]
}

const reminderSweepLockManager = createInMemoryExecutionLockManager()

export const getNotificationTaskRuntime = (
  env: Record<string, unknown>,
  options: Pick<NotificationTaskRuntimeOptions, "enqueueReminderDelivery"> = {},
) =>
  buildNotificationTaskRuntime(env, {
    resolveProviders: resolveNotificationProviders,
    reminderSweepLockManager,
    enqueueReminderDelivery: options.enqueueReminderDelivery,
  })
