import { createApp } from "./app.js"
import { createR2DispatchIntentStore } from "./dispatch-intent-store.js"
import { createR2TickSnapshotStore } from "./tick-snapshot-store.js"

interface Env {
  AGENT_CONTROL_PLANE_TOKENS?: string
  AGENT_DISPATCH_INTENT_KEY_PREFIX?: string
  AGENT_DISPATCH_INTENTS?: R2Bucket
  AGENT_TICK_SNAPSHOT_KEY_PREFIX?: string
  AGENT_TICK_SNAPSHOTS?: R2Bucket
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      authTokens: parseTokens(env.AGENT_CONTROL_PLANE_TOKENS),
      dispatchIntentStore: env.AGENT_DISPATCH_INTENTS
        ? createR2DispatchIntentStore({
            bucket: env.AGENT_DISPATCH_INTENTS,
            keyPrefix: env.AGENT_DISPATCH_INTENT_KEY_PREFIX,
          })
        : undefined,
      tickSnapshotStore: env.AGENT_TICK_SNAPSHOTS
        ? createR2TickSnapshotStore({
            bucket: env.AGENT_TICK_SNAPSHOTS,
            keyPrefix: env.AGENT_TICK_SNAPSHOT_KEY_PREFIX,
          })
        : undefined,
    })
    return await app.fetch(request)
  },
} satisfies ExportedHandler<Env>

function parseTokens(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}
