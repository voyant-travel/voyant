---
"@voyantjs/core": minor
---

EventBus: handlers now run **in parallel** (behavior change — previously sequential in subscription order; subscribers are independent observers by contract, so one slow handler no longer serializes the rest) and each handler is bounded by a per-handler timeout (`createEventBus({ handlerTimeoutMs })`, default 15s, `false` to disable — on timeout the handler is logged and no longer awaited, not cancelled). New `SubscribeOptions` (`subscribe(event, handler, { inline: true })`) and `EmitOptions` (`emit(event, data, metadata, { schedule })`): when an emitter supplies `schedule`, non-`inline` handlers are handed to it as one promise and `emit()` resolves after the `inline` handlers only — this is how `@voyantjs/hono` defers subscriber work past the HTTP response. Plugin `Subscriber` gains the matching optional `inline` flag, threaded through `registerPlugins`. Existing call sites are source-compatible (new parameters are optional).
