import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountOperatorMediaUploadRoutes } from "./media-upload-routes"

type TestRouteEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
  }
}

const storage = vi.hoisted(() => ({
  createMediaStorage: vi.fn(),
}))

vi.mock("./lib/storage", () => ({
  createMediaStorage: storage.createMediaStorage,
  guessMimeType: (key: string) => (key.endsWith(".pdf") ? "application/pdf" : "text/plain"),
}))

describe("operator media upload routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("streams stored media by key", async () => {
    const app = new Hono<TestRouteEnv>()
    storage.createMediaStorage.mockReturnValue({
      get: vi.fn(async () => new TextEncoder().encode("pdf").buffer),
    })
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/media/brochures/example.pdf")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    await expect(response.text()).resolves.toBe("pdf")
  })
})
