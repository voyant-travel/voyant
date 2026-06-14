/**
 * Channel-push core plugin.
 *
 * Bundles the EventBus subscribers that listen to `booking.confirmed`
 * (and later `availability.slot.changed`, `product.content.changed`)
 * and writes durable intent rows.
 *
 * Templates wire this via `registerPlugins([channelPushPlugin({ ... })],
 * { eventBus })` AFTER calling `setChannelPushDeps({ db, registry })`.
 *
 * Per docs/architecture/channel-push-architecture.md §4 + §10 (Phase D).
 */

import { definePlugin, type Plugin } from "@voyant-travel/core"

import { type ChannelPushSubscribersOptions, createChannelPushSubscribers } from "./subscriber.js"

export interface ChannelPushPluginOptions extends ChannelPushSubscribersOptions {}

export function channelPushPlugin(options: ChannelPushPluginOptions = {}): Plugin {
  return definePlugin({
    name: "channel-push",
    version: "0.1.0",
    subscribers: createChannelPushSubscribers(options),
  })
}
