/**
 * `@voyantjs/distribution/channel-push` — outbound channel-push pipeline.
 *
 * Per docs/architecture/channel-push-architecture.md.
 */

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
  type ChannelPushPluginOptions,
  channelPushPlugin,
} from "./plugin.js"
export {
  type ChannelPushSubscribersOptions,
  createChannelPushSubscribers,
  triggerBookingPushForBooking,
} from "./subscriber.js"
export {
  type ChannelPushDeps,
  type ChannelPushLogger,
  clearChannelPushDeps,
  defaultLogger,
  getChannelPushDeps,
  getChannelPushDepsOrThrow,
  setChannelPushDeps,
} from "./types.js"
