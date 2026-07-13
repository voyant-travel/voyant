import { pathToFileURL } from "node:url"

import { createOperatorProjectServerEntry } from "@voyant-travel/operator-runtime"

const server = createOperatorProjectServerEntry()

export default { fetch: server.fetch }

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const handle = await server.start({ port: Number.parseInt(process.env.PORT ?? "8080", 10) })
  console.info(`[operator] Node runtime listening on :${handle.port}`)
}
