import type { Actor } from "@voyant-travel/core"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import type { CompositionRegistry } from "../../src/composition.js"
import { createApp } from "../../src/create-app.js"
import { lazyProvider } from "../../src/lazy-provider.js"

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

  it("supports memoized lazy provider values", async () => {
    interface LazyCaps {
      service: { greet: () => Promise<string> }
    }

    let loads = 0
    const lazyRegistry: CompositionRegistry<LazyCaps> = {
      modules: {
        "@voyant-travel/lazy-demo": ({ capabilities }) => ({
          module: { name: "lazy-demo" },
          adminRoutes: new Hono().get("/ping", async (c) =>
            c.text(await capabilities.service.greet()),
          ),
        }),
      },
    }

    const app = createApp<Record<string, never>, LazyCaps>({
      manifest: { modules: ["@voyant-travel/lazy-demo"] },
      registry: lazyRegistry,
      capabilities: {
        service: lazyProvider(async () => {
          loads += 1
          return { greet: async () => "lazy-pong" }
        }),
      },
      db: () => ({}) as never,
      auth: { resolve: () => ({ userId: "u1", actor: "staff" }) },
    })

    expect(loads).toBe(0)
    const first = await app.request("/v1/admin/lazy-demo/ping", {}, {} as never)
    const second = await app.request("/v1/admin/lazy-demo/ping", {}, {} as never)
    expect(await first.text()).toBe("lazy-pong")
    expect(await second.text()).toBe("lazy-pong")
    expect(loads).toBe(1)
  })
})
