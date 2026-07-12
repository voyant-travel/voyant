import { createOperatorAuthNodeRuntime } from "@voyant-travel/auth/operator-node-runtime"
import type { VoyantDb } from "@voyant-travel/hono"
import { accessCatalog } from "../../../.voyant/access/selected-access-catalog.generated"

import type { CurrentUser } from "../../lib/current-user-model"
import { resolveEmailReplyTo } from "../../lib/notifications"
import { OPERATOR_APP_NAME, operatorReporter } from "../../lib/observability"
import { tryGetCloudClient } from "../../lib/voyant-cloud"
import { dbFromEnvForApp } from "../lib/db"
import { buildBetterAuthCookieAdvancedOptions } from "./cookie-domain"

const runtime = createOperatorAuthNodeRuntime<AppBindings>({
  accessCatalog,
  appName: OPERATOR_APP_NAME,
  reporter: operatorReporter,
  openDatabase: (env) => {
    const resource = dbFromEnvForApp(env)
    return { db: resource.db as VoyantDb, dispose: resource.dispose }
  },
  cookieAdvanced: buildBetterAuthCookieAdvancedOptions,
  resolveEmailSender: (env) => {
    const cloud = tryGetCloudClient(env)
    if (!cloud) return null

    const from = env.EMAIL_FROM || "Voyant <noreply@voyantcloud.app>"
    const replyTo = resolveEmailReplyTo(env)
    return {
      sendResetPassword: async ({ user, url }) => {
        await cloud.email.sendMessage({
          from,
          to: [user.email],
          subject: "Reset your password",
          html: `<p>Hi ${user.name},</p><p>Click <a href="${url}">here</a> to reset your password.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
          ...(replyTo ? { replyTo } : {}),
        })
      },
      sendVerificationOtp: async ({ email, otp, type }) => {
        await cloud.email.sendMessage({
          from,
          to: [email],
          subject: type === "email-verification" ? "Verify your email" : "Your verification code",
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
          ...(replyTo ? { replyTo } : {}),
        })
      },
    }
  },
})

export const {
  getBootstrapStatusForRequest,
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} = runtime

export async function getCurrentUserForRequest(
  request: Request,
  env: AppBindings,
): Promise<CurrentUser | null> {
  return (await runtime.getCurrentUserForRequest(request, env)) as CurrentUser | null
}

export default runtime.handler
