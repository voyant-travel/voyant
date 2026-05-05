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
