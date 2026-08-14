import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"
import { publicApiVerificationRuntimePort } from "../runtime-port.js"
import {
  buildPublicApiVerificationSenderBundle,
  createPublicApiVerificationPublicRoutes,
  STOREFRONT_VERIFICATION_SENDERS_CONTAINER_KEY,
  type PublicApiVerificationChannelCoverage,
  type PublicApiVerificationRoutesOptions,
} from "./routes-public.js"
import { publicApiVerificationModule } from "./schema.js"

export type {
  ConsumeVerifiedChallengeInput,
  ConsumeVerifiedChallengeResult,
} from "./consume.js"
export {
  consumeVerifiedChallenge,
  peekVerifiedChallengeDestination,
  STOREFRONT_VERIFICATION_BOOKING_CREATE_PURPOSE,
} from "./consume.js"
export type {
  PublicApiVerificationChannelCoverage,
  PublicApiVerificationPublicRoutes,
  PublicApiVerificationRoutesOptions,
  PublicApiVerificationSenderBundle,
} from "./routes-public.js"
export {
  buildPublicApiVerificationSenderBundle,
  buildPublicApiVerificationSenders,
  createPublicApiVerificationPublicRoutes,
  resolvePublicApiVerificationChannelCoverage,
  STOREFRONT_VERIFICATION_SENDERS_CONTAINER_KEY,
} from "./routes-public.js"
export type {
  NewCustomerVerificationChallenge,
  CustomerVerificationChallenge,
} from "./schema.js"
export {
  customerVerificationChallenges,
  publicApiVerificationChannelEnum,
  publicApiVerificationLinkable,
  publicApiVerificationModule,
  publicApiVerificationStatusEnum,
} from "./schema.js"
export type {
  PublicApiVerificationDeliveryResult,
  PublicApiVerificationEmailSendInput,
  PublicApiVerificationNotificationChannel,
  PublicApiVerificationNotificationPayload,
  PublicApiVerificationNotificationProvider,
  PublicApiVerificationNotificationResult,
  PublicApiVerificationProviderOptions,
  PublicApiVerificationSenders,
  PublicApiVerificationServiceOptions,
  PublicApiVerificationSmsSendInput,
} from "./service.js"
export {
  createPublicApiVerificationSendersFromProviders,
  createPublicApiVerificationService,
  PublicApiVerificationError,
} from "./service.js"
export type {
  ConfirmEmailVerificationChallengeInput,
  ConfirmSmsVerificationChallengeInput,
  StartEmailVerificationChallengeInput,
  StartSmsVerificationChallengeInput,
  CustomerVerificationChallengeRecord,
  PublicApiVerificationChannel,
  PublicApiVerificationConfirmResult,
  PublicApiVerificationStartResult,
  PublicApiVerificationStatus,
} from "./validation.js"
export {
  confirmEmailVerificationChallengeSchema,
  confirmSmsVerificationChallengeSchema,
  startEmailVerificationChallengeSchema,
  startSmsVerificationChallengeSchema,
  publicApiVerificationChallengeRecordSchema,
  publicApiVerificationChannelSchema,
  publicApiVerificationConfirmResultSchema,
  publicApiVerificationStartResultSchema,
  publicApiVerificationStatusSchema,
} from "./validation.js"

/**
 * Report a *partial* channel gap at bootstrap rather than at the first shopper.
 *
 * Both start routes mount unconditionally, so a deployment with no SMS-capable
 * provider looks healthy until a guest who gave a phone number is answered with
 * a 501 and cannot book at all (voyant#3948). Surfacing the gap when the module
 * boots gives an operator a signal at the point they can still act on it.
 *
 * Deliberately silent when *no* channel resolves. Bootstrap runs with whatever
 * bindings triggered it — the first request passes the real env, but
 * `app.ready()` defaults to `{}`, which every test and node sibling process
 * uses. An empty provider set is therefore indistinguishable from "bootstrapped
 * without bindings", and warning on it would fire on boots that are not
 * misconfigured at all. A deployment that truly configures no provider still
 * fails loudly on the first start request, naming the same gap.
 */
function warnUndeliverableChannels({
  supported,
  unsupported,
}: PublicApiVerificationChannelCoverage) {
  if (unsupported.length === 0 || supported.length === 0) return

  console.warn(
    `[storefront/verification] No notification provider delivers ${unsupported
      .map((channel) => `"${channel}"`)
      .join(" or ")}; those start routes will answer 501 sender_not_configured. ` +
      `Deliverable channels: ${supported.join(", ")}. Configure a verification notification provider covering the missing channel, or stop offering it in the storefront.`,
  )
}

export function createPublicApiVerificationApiModule(
  options?: PublicApiVerificationRoutesOptions,
): ApiModule {
  const module: Module = {
    ...publicApiVerificationModule,
    bootstrap: ({ bindings, container }) => {
      const { senders, coverage } = buildPublicApiVerificationSenderBundle(
        bindings as Record<string, unknown>,
        options,
      )
      warnUndeliverableChannels(coverage)
      container.register(STOREFRONT_VERIFICATION_SENDERS_CONTAINER_KEY, senders)
    },
  }

  return {
    module,
    publicRoutes: stampOpenApiRegistryApiId(
      createPublicApiVerificationPublicRoutes(options),
      "@voyant-travel/public-api#verification.api",
    ),
  }
}

export const createPublicApiVerificationVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) =>
    createPublicApiVerificationApiModule(await getPort(publicApiVerificationRuntimePort)),
)
