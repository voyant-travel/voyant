import { createPostgresAdvisoryLockManager } from "@voyantjs/db/runtime"
import {
  buildNotificationTaskRuntime,
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
  type NotificationProvider,
  type NotificationTaskRuntimeOptions,
} from "@voyantjs/notifications"
import { getVoyantCloudClient } from "./cloud-client.js"

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

function resolveReminderSweepLockManager(env: Record<string, unknown>) {
  const connectionString =
    typeof env.DATABASE_URL === "string" && env.DATABASE_URL.length > 0 ? env.DATABASE_URL : null

  return connectionString
    ? createPostgresAdvisoryLockManager(connectionString, {
        namespace: "operator",
      })
    : undefined
}

export const getNotificationTaskRuntime = (
  env: Record<string, unknown>,
  options: Pick<NotificationTaskRuntimeOptions, "enqueueReminderDelivery"> = {},
) =>
  buildNotificationTaskRuntime(env, {
    resolveProviders: resolveNotificationProviders,
    reminderSweepLockManager: resolveReminderSweepLockManager(env),
    enqueueReminderDelivery: options.enqueueReminderDelivery,
  })
