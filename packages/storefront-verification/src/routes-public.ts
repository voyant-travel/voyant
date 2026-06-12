import type { ModuleContainer } from "@voyantjs/core"
import { clientIpKey, enforceRateLimit, parseJsonBody } from "@voyantjs/hono"
import type { NotificationProvider } from "@voyantjs/notifications"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type Context, Hono } from "hono"
import {
  createStorefrontVerificationSendersFromProviders,
  createStorefrontVerificationService,
  StorefrontVerificationError,
  type StorefrontVerificationProviderOptions,
  type StorefrontVerificationSenders,
  type StorefrontVerificationServiceOptions,
} from "./service.js"
import {
  confirmEmailVerificationChallengeSchema,
  confirmSmsVerificationChallengeSchema,
  startEmailVerificationChallengeSchema,
  startSmsVerificationChallengeSchema,
} from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export interface StorefrontVerificationRoutesOptions
  extends StorefrontVerificationServiceOptions,
    StorefrontVerificationProviderOptions {
  sendEmailChallenge?: StorefrontVerificationSenders["sendEmailChallenge"]
  sendSmsChallenge?: StorefrontVerificationSenders["sendSmsChallenge"]
  providers?: ReadonlyArray<NotificationProvider>
  resolveProviders?: (bindings: Record<string, unknown>) => ReadonlyArray<NotificationProvider>
}

export const STOREFRONT_VERIFICATION_SENDERS_CONTAINER_KEY =
  "providers.storefrontVerification.senders"

export function buildStorefrontVerificationSenders(
  bindings: Record<string, unknown>,
  options?: StorefrontVerificationRoutesOptions,
): StorefrontVerificationSenders {
  const senders: StorefrontVerificationSenders = {
    sendEmailChallenge: options?.sendEmailChallenge,
    sendSmsChallenge: options?.sendSmsChallenge,
  }

  if (!senders.sendEmailChallenge || !senders.sendSmsChallenge) {
    const providers = options?.resolveProviders?.(bindings) ?? options?.providers
    if (providers?.length) {
      const providerSenders = createStorefrontVerificationSendersFromProviders(providers, options)
      senders.sendEmailChallenge ??= providerSenders.sendEmailChallenge
      senders.sendSmsChallenge ??= providerSenders.sendSmsChallenge
    }
  }

  return senders
}

function getSenders(
  bindings: Record<string, unknown>,
  options: StorefrontVerificationRoutesOptions | undefined,
  resolveFromContainer?: <T>(key: string) => T,
): StorefrontVerificationSenders {
  if (resolveFromContainer) {
    try {
      return resolveFromContainer<StorefrontVerificationSenders>(
        STOREFRONT_VERIFICATION_SENDERS_CONTAINER_KEY,
      )
    } catch {
      // Fall back to per-request sender construction when bootstrap has not run.
    }
  }

  return buildStorefrontVerificationSenders(bindings, options)
}

function errorResponse(error: unknown) {
  if (error instanceof StorefrontVerificationError) {
    if (error.code === "sender_not_configured") {
      return { status: 501 as const, body: { error: error.message, code: error.code } }
    }

    if (error.code === "challenge_not_found") {
      return { status: 404 as const, body: { error: error.message, code: error.code } }
    }

    if (error.code === "challenge_expired") {
      return { status: 410 as const, body: { error: error.message, code: error.code } }
    }

    if (error.code === "challenge_invalid" || error.code === "challenge_failed") {
      return { status: 409 as const, body: { error: error.message, code: error.code } }
    }
  }

  const message = error instanceof Error ? error.message : "Verification request failed"
  return { status: 400 as const, body: { error: message } }
}

function normalizeDestination(channel: "email" | "sms", destination: string): string {
  return channel === "email" ? destination.trim().toLowerCase() : destination.trim()
}

async function enforceVerificationStartLimits(
  c: Context<Env>,
  channel: "email" | "sms",
  destination: string,
) {
  const normalized = normalizeDestination(channel, destination)
  return (
    (await enforceRateLimit(c, {
      bucket: `storefront-verification:${channel}:destination-cooldown`,
      max: 1,
      windowSeconds: 30,
      clientKey: () => normalized,
    })) ??
    (await enforceRateLimit(c, {
      bucket: `storefront-verification:${channel}:destination-hour`,
      max: channel === "sms" ? 5 : 10,
      windowSeconds: 60 * 60,
      clientKey: () => normalized,
    })) ??
    (await enforceRateLimit(c, {
      bucket: `storefront-verification:${channel}:ip-hour`,
      max: channel === "sms" ? 20 : 40,
      windowSeconds: 60 * 60,
      clientKey: clientIpKey,
    }))
  )
}

export function createStorefrontVerificationPublicRoutes(
  options?: StorefrontVerificationRoutesOptions,
) {
  const service = createStorefrontVerificationService(options)

  return new Hono<Env>()
    .post("/email/start", async (c) => {
      try {
        const body = await parseJsonBody(c, startEmailVerificationChallengeSchema)
        const limited = await enforceVerificationStartLimits(c, "email", body.email)
        if (limited) return limited
        const result = await service.startEmailChallenge(
          c.get("db"),
          body,
          getSenders(c.env, options, (key) => c.var.container.resolve(key)),
        )
        return c.json({ data: result }, 201)
      } catch (error) {
        const response = errorResponse(error)
        return c.json(response.body, response.status)
      }
    })
    .post("/email/confirm", async (c) => {
      try {
        const result = await service.confirmEmailChallenge(
          c.get("db"),
          await parseJsonBody(c, confirmEmailVerificationChallengeSchema),
        )
        return c.json({ data: result })
      } catch (error) {
        const response = errorResponse(error)
        return c.json(response.body, response.status)
      }
    })
    .post("/sms/start", async (c) => {
      try {
        const body = await parseJsonBody(c, startSmsVerificationChallengeSchema)
        const limited = await enforceVerificationStartLimits(c, "sms", body.phone)
        if (limited) return limited
        const result = await service.startSmsChallenge(
          c.get("db"),
          body,
          getSenders(c.env, options, (key) => c.var.container.resolve(key)),
        )
        return c.json({ data: result }, 201)
      } catch (error) {
        const response = errorResponse(error)
        return c.json(response.body, response.status)
      }
    })
    .post("/sms/confirm", async (c) => {
      try {
        const result = await service.confirmSmsChallenge(
          c.get("db"),
          await parseJsonBody(c, confirmSmsVerificationChallengeSchema),
        )
        return c.json({ data: result })
      } catch (error) {
        const response = errorResponse(error)
        return c.json(response.body, response.status)
      }
    })
}

export type StorefrontVerificationPublicRoutes = ReturnType<
  typeof createStorefrontVerificationPublicRoutes
>
