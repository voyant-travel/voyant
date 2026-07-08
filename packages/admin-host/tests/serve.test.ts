import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { ExecutionContext } from "hono"
import { describe, expect, it } from "vitest"

import { serveManagedProfileAdmin } from "../src/serve.js"

function createAssetsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "admin-host-"))
  mkdirSync(join(dir, "assets"), { recursive: true })
  writeFileSync(join(dir, "assets", "x.txt"), "hello")
  return dir
}

/** Minimal execution context, mirroring how the Node host supplies one. */
const ctx: ExecutionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
  props: undefined,
}

describe("serveManagedProfileAdmin", () => {
  it("serves built client assets", async () => {
    const clientAssetsDir = createAssetsDir()
    const web = serveManagedProfileAdmin({
      clientAssetsDir,
      app: () => new Response("APP", { status: 200 }),
    })

    const response = await web.request("/assets/x.txt")

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("hello")
  })

  it("falls through to the app for non-asset routes", async () => {
    const clientAssetsDir = createAssetsDir()
    const web = serveManagedProfileAdmin({
      clientAssetsDir,
      app: () => new Response("APP", { status: 200 }),
    })

    const response = await web.request("/anything-else", {}, {}, ctx)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("APP")
  })
})
