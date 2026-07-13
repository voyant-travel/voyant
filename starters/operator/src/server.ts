import { pathToFileURL } from "node:url"

import {
  createVoyantProjectServerEntry,
  type LoadVoyantProjectOptions,
} from "@voyant-travel/runtime"

const server = createVoyantProjectServerEntry()

export default {
  fetch: server.fetch,
  start: (options: LoadVoyantProjectOptions & { port?: number } = {}) => {
    const { port, ...projectOptions } = options
    return createVoyantProjectServerEntry(projectOptions).start({ port })
  },
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const handle = await server.start({ port: Number.parseInt(process.env.PORT ?? "8080", 10) })
  console.info(`[voyant] Node runtime listening on :${handle.port}`)
}
