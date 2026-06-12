// @vitest-environment node

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

const videoUploads = vi.hoisted(() => ({
  createVideoUploadTicket: vi.fn(async () => ({ uploadUrl: "https://uploads.example/video" })),
}))

vi.mock("./lib/storage", () => ({
  createMediaStorage: storage.createMediaStorage,
  guessMimeType: (key: string) => {
    if (key.endsWith(".pdf")) return "application/pdf"
    if (key.endsWith(".svg")) return "image/svg+xml"
    return "text/plain"
  },
}))

vi.mock("../lib/video-uploads", () => videoUploads)

function multipartFileBody(options: {
  boundary: string
  filename: string
  contentType: string
  body: string
}) {
  return [
    `--${options.boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${options.filename}"`,
    `Content-Type: ${options.contentType}`,
    "",
    options.body,
    `--${options.boundary}--`,
    "",
  ].join("\r\n")
}

describe("operator media upload routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("streams stored media by allowed key as an attachment", async () => {
    const app = new Hono<TestRouteEnv>()
    storage.createMediaStorage.mockReturnValue({
      get: vi.fn(async () => new TextEncoder().encode("pdf").buffer),
    })
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/media/brochures/products/example.pdf")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
    await expect(response.text()).resolves.toBe("pdf")
  })

  it("rejects media keys outside allowed upload prefixes", async () => {
    const app = new Hono<TestRouteEnv>()
    const get = vi.fn(async () => new TextEncoder().encode("private").buffer)
    storage.createMediaStorage.mockReturnValue({ get })
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/media/private/example.pdf")

    expect(response.status).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })

  it("forces scriptable stored media to octet-stream", async () => {
    const app = new Hono<TestRouteEnv>()
    storage.createMediaStorage.mockReturnValue({
      get: vi.fn(async () => new TextEncoder().encode("<svg />").buffer),
    })
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/media/uploads/evil.svg")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="evil.svg"')
  })

  it("serves media through the admin surface with the same hardening", async () => {
    const app = new Hono<TestRouteEnv>()
    const get = vi.fn(async () => new TextEncoder().encode("pdf").buffer)
    storage.createMediaStorage.mockReturnValue({ get })
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/admin/media/uploads/example.pdf")

    expect(response.status).toBe(200)
    expect(get).toHaveBeenCalledWith("uploads/example.pdf")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
  })

  it("rejects unsafe upload types", async () => {
    const app = new Hono<TestRouteEnv>()
    const upload = vi.fn()
    storage.createMediaStorage.mockReturnValue({ upload })
    mountOperatorMediaUploadRoutes(app)

    const boundary = "----voyant-test-boundary"

    const response = await app.request("/v1/uploads", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: multipartFileBody({
        boundary,
        filename: "evil.svg",
        contentType: "image/svg+xml",
        body: "<svg />",
      }),
    })

    expect(response.status).toBe(415)
    expect(upload).not.toHaveBeenCalled()
  })

  it("accepts bounded uploads on the admin surface", async () => {
    const app = new Hono<TestRouteEnv>()
    const upload = vi.fn(
      async (_body: ArrayBuffer, options: { key: string; contentType: string }) => ({
        key: options.key,
        url: `/api/v1/media/${options.key}`,
      }),
    )
    storage.createMediaStorage.mockReturnValue({ upload })
    mountOperatorMediaUploadRoutes(app)

    const boundary = "----voyant-test-boundary"

    const response = await app.request("/v1/admin/uploads", {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body: multipartFileBody({
        boundary,
        filename: "photo.png",
        contentType: "image/png",
        body: "png",
      }),
    })

    expect(response.status).toBe(200)
    expect(upload).toHaveBeenCalledOnce()
    expect(upload.mock.calls[0]?.[1]).toMatchObject({
      contentType: "image/png",
    })
    const body = (await response.json()) as { key: string; mimeType: string; size: number }
    expect(body.key).toMatch(/^uploads\/\d+-[a-f0-9-]+\.png$/)
    expect(body.mimeType).toBe("image/png")
    expect(body.size).toBe(3)
  })

  it("validates video upload ticket requests on the admin surface", async () => {
    const app = new Hono<TestRouteEnv>()
    mountOperatorMediaUploadRoutes(app)

    const response = await app.request("/v1/admin/uploads/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileSize: 1024,
        maxDurationSeconds: 60,
        name: "clip.mp4",
      }),
    })

    expect(response.status).toBe(200)
    expect(videoUploads.createVideoUploadTicket).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        fileSize: 1024,
        maxDurationSeconds: 60,
        name: "clip.mp4",
      }),
    )
  })
})
