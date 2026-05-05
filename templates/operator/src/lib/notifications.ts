import { getVoyantCloudClient } from "@voyantjs/cloud-sdk"
import { createPostgresAdvisoryLockManager } from "@voyantjs/db/runtime"
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
  const replyTo = resolveEmailReplyTo(env)
  return [
    createVoyantCloudEmailProvider({ client: cloud, from, ...(replyTo ? { replyTo } : {}) }),
    createVoyantCloudSmsProvider({ client: cloud }),
  ]
}

export function resolveEmailReplyTo(env: { EMAIL_REPLY_TO?: unknown }): string[] | null {
  if (typeof env.EMAIL_REPLY_TO !== "string") return null
  const addresses = env.EMAIL_REPLY_TO.split(",")
    .map((address) => address.trim())
    .filter(Boolean)
  return addresses.length > 0 ? addresses : null
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
