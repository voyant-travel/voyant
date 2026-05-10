import { createApp } from "./app.js"

const app = createApp()

export default {
  async fetch(request: Request): Promise<Response> {
    return await app.fetch(request)
  },
} satisfies ExportedHandler
