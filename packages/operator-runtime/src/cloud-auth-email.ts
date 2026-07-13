import type { OperatorAuthEmailSender } from "@voyant-travel/auth/operator-node-runtime"
import { getVoyantCloudClient, type VoyantCloudClient } from "@voyant-travel/cloud-sdk"

type CloudAuthEmailEnv = object

const DEFAULT_EMAIL_FROM = "Voyant <noreply@voyantcloud.app>"
const LOCAL_PLACEHOLDER_KEYS = new Set(["local-dev"])
const CLIENT_CACHE = new WeakMap<object, Map<string, VoyantCloudClient>>()

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 && !LOCAL_PLACEHOLDER_KEYS.has(trimmed) ? trimmed : undefined
}

function readEnv(env: CloudAuthEmailEnv, key: string): unknown {
  return Reflect.get(env, key)
}

function resolveApiKey(env: CloudAuthEmailEnv): string | undefined {
  return nonEmpty(readEnv(env, "VOYANT_API_KEY")) ?? nonEmpty(readEnv(env, "VOYANT_CLOUD_API_KEY"))
}

function resolveCloudClient(env: CloudAuthEmailEnv, apiKey: string): VoyantCloudClient {
  const clients = CLIENT_CACHE.get(env)
  const cached = clients?.get(apiKey)
  if (cached) return cached

  const baseUrl = nonEmpty(readEnv(env, "VOYANT_CLOUD_API_URL"))
  const userAgent = nonEmpty(readEnv(env, "VOYANT_CLOUD_USER_AGENT"))
  const client = getVoyantCloudClient(
    {
      VOYANT_CLOUD_API_KEY: apiKey,
      ...(baseUrl ? { VOYANT_CLOUD_API_URL: baseUrl } : {}),
      ...(userAgent ? { VOYANT_CLOUD_USER_AGENT: userAgent } : {}),
    },
    { apiKey },
  )
  const nextClients = clients ?? new Map<string, VoyantCloudClient>()
  nextClients.set(apiKey, client)
  CLIENT_CACHE.set(env, nextClients)
  return client
}

function resolveReplyTo(env: CloudAuthEmailEnv): string[] | undefined {
  const value = nonEmpty(readEnv(env, "EMAIL_REPLY_TO"))
  if (!value) return undefined
  const addresses = value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
  return addresses.length > 0 ? addresses : undefined
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  )
}

/** Resolve the standard Operator auth mail transport from Node environment values. */
export function resolveOperatorCloudAuthEmailSender(
  env: CloudAuthEmailEnv,
): OperatorAuthEmailSender | null {
  const apiKey = resolveApiKey(env)
  if (!apiKey) return null

  const cloud = resolveCloudClient(env, apiKey)
  const from = nonEmpty(readEnv(env, "EMAIL_FROM")) ?? DEFAULT_EMAIL_FROM
  const replyTo = resolveReplyTo(env)
  return {
    async sendResetPassword({ user, url }) {
      await cloud.email.sendMessage({
        from,
        to: [user.email],
        subject: "Reset your password",
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>Click <a href="${escapeHtml(url)}">here</a> to reset your password.</p><p>If you didn&#39;t request this, you can safely ignore this email.</p>`,
        ...(replyTo ? { replyTo } : {}),
      })
    },
    async sendVerificationOtp({ email, otp, type }) {
      await cloud.email.sendMessage({
        from,
        to: [email],
        subject: type === "email-verification" ? "Verify your email" : "Your verification code",
        html: `<p>Your verification code is: <strong>${escapeHtml(otp)}</strong></p><p>This code expires in 10 minutes.</p>`,
        ...(replyTo ? { replyTo } : {}),
      })
    },
  }
}
