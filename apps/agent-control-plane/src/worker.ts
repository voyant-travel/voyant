import { createApp } from "./app.js"

interface Env {
  AGENT_CONTROL_PLANE_TOKENS?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({ authTokens: parseTokens(env.AGENT_CONTROL_PLANE_TOKENS) })
    return await app.fetch(request)
  },
} satisfies ExportedHandler<Env>

function parseTokens(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}
