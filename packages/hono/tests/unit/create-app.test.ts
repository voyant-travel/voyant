import type { Actor } from "@voyant-travel/core"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import type { CompositionRegistry } from "../../src/composition.js"
import { createApp } from "../../src/create-app.js"

interface Caps {
  greeting: string
}

// A registry whose factory reads `capabilities` — proving the config-driven
// front door threads capabilities through to each entry.
const registry: CompositionRegistry<Caps> = {
  modules: {
    "@voyant-travel/demo": ({ capabilities }) => ({
      module: { name: "demo" },
      adminRoutes: new Hono().get("/ping", (c) => c.text(capabilities.greeting)),
    }),
  },
}

function build() {
  return createApp<Record<string, never>, Caps>({
    manifest: { modules: ["@voyant-travel/demo"] },
    registry,
    capabilities: { greeting: "pong" },
    // biome-ignore lint/suspicious/noExplicitAny: stub db for the mount smoke test.
    db: () => ({}) as any,
    auth: {
      resolve: ({ request }) => ({
        userId: "u1",
        actor: (new URL(request.url).pathname.startsWith("/v1/public/")
          ? "customer"
          : "staff") as Actor,
      }),
    },
  })
}

describe("createApp (config-driven front door)", () => {
  it("derives modules from manifest+registry and mounts them, threading capabilities", async () => {
    const app = build()
    const res = await app.request("/v1/admin/demo/ping", {}, {} as never)
    expect(res.status).toBe(200)
    // The body is the capability value, so it flowed manifest → registry → mount.
    expect(await res.text()).toBe("pong")
  })

  it("does not mount entries absent from the manifest", async () => {
    const app = build()
    const res = await app.request("/v1/admin/not-mounted/x", {}, {} as never)
    expect(res.status).toBe(404)
  })
})
