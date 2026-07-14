import { pathToFileURL } from "node:url"
import type { LoadVoyantProjectOptions } from "@voyant-travel/runtime"
import { createVoyantProjectServerEntry } from "@voyant-travel/runtime"

const server = createVoyantProjectServerEntry()
const start = (options: LoadVoyantProjectOptions & { port?: number } = {}) => {
  const { port, ...projectOptions } = options
  return createVoyantProjectServerEntry(projectOptions).start({ port })
}
export default { fetch: server.fetch, start }
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const handle = await server.start({ port: Number.parseInt(process.env.PORT ?? "8080", 10) })
  console.info(`[voyant] Node runtime listening on :${handle.port}`)
}
