// @vitest-environment node

import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createMediaRoutes, type MediaRoutesOptions } from "./routes.js"
import type { StorageProvider } from "./types.js"

function makeStorage(overrides: Partial<StorageProvider>): StorageProvider {
  return {
    name: "stub",
    upload: vi.fn(async () => ({ key: "k", url: "/u" })),
    delete: vi.fn(async () => {}),
    signedUrl: vi.fn(async () => "/signed"),
    get: vi.fn(async () => null),
    ...overrides,
  }
}

function mountApp(
  options: Partial<MediaRoutesOptions> & { resolveStorage?: MediaRoutesOptions["resolveStorage"] },
) {
  const app = new Hono()
  app.route(
    "/",
    createMediaRoutes({
      resolveStorage: options.resolveStorage ?? (() => null),
      signVideoUploadTicket:
        options.signVideoUploadTicket ??
        (async () => ({ uploadUrl: "https://uploads.example/video" })),
      ...(options.guessServedMimeType ? { guessServedMimeType: options.guessServedMimeType } : {}),
    }),
  )
  return app
}

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

describe("media routes", () => {
  it("streams stored media by allowed key as an attachment", async () => {
    const storage = makeStorage({ get: vi.fn(async () => new TextEncoder().encode("pdf").buffer) })
    const app = mountApp({ resolveStorage: () => storage })

    const response = await app.request("/v1/admin/media/brochures/products/example.pdf")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
    await expect(response.text()).resolves.toBe("pdf")
  })

  it("rejects media keys outside allowed upload prefixes", async () => {
    const get = vi.fn(async () => new TextEncoder().encode("private").buffer)
    const app = mountApp({ resolveStorage: () => makeStorage({ get }) })

    const response = await app.request("/v1/admin/media/private/example.pdf")

    expect(response.status).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })

  it("forces scriptable stored media to octet-stream", async () => {
    const storage = makeStorage({
      get: vi.fn(async () => new TextEncoder().encode("<svg />").buffer),
    })
    const app = mountApp({ resolveStorage: () => storage })

    const response = await app.request("/v1/admin/media/uploads/evil.svg")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="evil.svg"')
  })

  it("serves media through the admin surface with the same hardening", async () => {
    const get = vi.fn(async () => new TextEncoder().encode("pdf").buffer)
    const app = mountApp({ resolveStorage: () => makeStorage({ get }) })

    const response = await app.request("/v1/admin/media/uploads/example.pdf")

    expect(response.status).toBe(200)
    expect(get).toHaveBeenCalledWith("uploads/example.pdf")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
  })

  it("responds 503 when storage is unconfigured", async () => {
    const app = mountApp({ resolveStorage: () => null })
    const response = await app.request("/v1/admin/media/uploads/example.pdf")
    expect(response.status).toBe(503)
  })

  it("rejects unsafe upload types", async () => {
    const upload = vi.fn()
    const app = mountApp({ resolveStorage: () => makeStorage({ upload }) })

    const boundary = "----voyant-test-boundary"

    const response = await app.request("/v1/admin/uploads", {
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
    const upload = vi.fn(
      async (_body: ArrayBuffer, options: { key: string; contentType: string }) => ({
        key: options.key,
        url: `/api/v1/admin/media/${options.key}`,
      }),
    )
    const app = mountApp({ resolveStorage: () => makeStorage({ upload }) })

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
    expect(upload.mock.calls[0]?.[1]).toMatchObject({ contentType: "image/png" })
    const body = (await response.json()) as { key: string; mimeType: string; size: number }
    expect(body.key).toMatch(/^uploads\/\d+-[a-f0-9-]+\.png$/)
    expect(body.mimeType).toBe("image/png")
    expect(body.size).toBe(3)
  })

  it("validates video upload ticket requests on the admin surface", async () => {
    const signVideoUploadTicket = vi.fn(async () => ({
      uploadUrl: "https://uploads.example/video",
    }))
    const app = mountApp({ signVideoUploadTicket })

    const response = await app.request("/v1/admin/uploads/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileSize: 1024, maxDurationSeconds: 60, name: "clip.mp4" }),
    })

    expect(response.status).toBe(200)
    expect(signVideoUploadTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fileSize: 1024, maxDurationSeconds: 60, name: "clip.mp4" }),
    )
  })

  it("rejects an invalid video upload ticket body", async () => {
    const signVideoUploadTicket = vi.fn()
    const app = mountApp({ signVideoUploadTicket })

    const response = await app.request("/v1/admin/uploads/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileSize: -1, maxDurationSeconds: 60 }),
    })

    expect(response.status).toBe(400)
    expect(signVideoUploadTicket).not.toHaveBeenCalled()
  })
})
