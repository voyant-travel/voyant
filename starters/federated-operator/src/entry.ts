import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { createWorkerFetch, withActiveRouteSsrManifest } from "@voyant-travel/runtime-core"
import { federatedOperatorApiDispatch } from "./hono-api-dispatch"

const startHandler = createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))

const workerFetch = createWorkerFetch<CloudflareBindings, ExecutionContext>({
  api: federatedOperatorApiDispatch,
  ssr: (request, env) => startHandler(request, { context: { env } } as never),
})

export default {
  fetch: workerFetch,
}
