import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createConversationsRoutes } from "../src/routes.js"

const artifactPath = resolve(import.meta.dirname, "../openapi/admin/conversations.json")
const committed = JSON.parse(readFileSync(artifactPath, "utf8"))
const app = createConversationsRoutes({
  resolveDb: () => {
    throw new Error("OpenAPI replay does not execute handlers")
  },
})
const live = app.getOpenAPI31Document({ info: committed.info, servers: committed.servers })
writeFileSync(artifactPath, `${JSON.stringify({ ...committed, paths: live.paths }, null, 2)}\n`)
