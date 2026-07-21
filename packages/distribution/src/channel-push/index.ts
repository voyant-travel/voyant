/**
 * `@voyant-travel/distribution` — outbound channel-push pipeline.
 *
 * Per docs/architecture/channel-push-architecture.md.
 */

export {
  type ChannelPushAdminRoutes,
  createChannelPushAdminRoutes,
} from "./admin-routes.js"
export {
  CHANNEL_AVAILABILITY_PUSH_WORKFLOW_ID,
  type ProcessAvailabilityPushInput,
  type ProcessAvailabilityPushResult,
  processAvailabilityPushIntents,
  type ResolveAllotmentTargetsForSlotInput,
  resolveAllotmentTargetsForSlot,
  upsertAvailabilityIntent,
} from "./availability-push.js"
export {
  bookingPushIdempotencyKey,
  CHANNEL_BOOKING_PUSH_WORKFLOW_ID,
  type ProcessBookingPushInput,
  type ProcessBookingPushResult,
  processBookingPush,
  resolveBookingPushTargets,
  upsertPendingBookingLinks,
} from "./booking-push.js"
export {
  CHANNEL_CONTENT_PUSH_WORKFLOW_ID,
  canonicalHash,
  type ProcessContentPushInput,
  type ProcessContentPushResult,
  processContentPushIntents,
  resolveContentPushTargets,
  upsertContentIntent,
} from "./content-push.js"
export {
  type ChannelPushExtensionOptions,
  channelPushExtensionDef,
  createChannelPushExtension,
  createChannelPushVoyantRuntime,
} from "./extension.js"
export {
  type ChannelPushPluginOptions,
  channelPushPlugin,
} from "./plugin.js"
export {
  type AvailabilityReconcilerOptions,
  type BookingLinkReconcilerOptions,
  type ContentReconcilerOptions,
  type ReconcilerResult,
  reconcileAvailability,
  reconcileBookingLinks,
  reconcileContent,
  runAllReconcilers,
} from "./reconciler.js"
export {
  type ChannelPushRuntime,
  channelPushRuntimePort,
} from "./runtime-port.js"
export {
  type ChannelPushSubscribersOptions,
  createChannelPushSubscribers,
  triggerBookingPushForBooking,
} from "./subscriber.js"
export {
  CHANNEL_PUSH_RUNTIME_KEY,
  type ChannelPushDeps,
  type ChannelPushLogger,
  clearChannelPushDeps,
  defaultLogger,
  getChannelPushDeps,
  getChannelPushDepsOrThrow,
  setChannelPushDeps,
} from "./types.js"
