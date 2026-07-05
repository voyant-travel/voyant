import { describe, expect, it, vi } from "vitest"

import { createDayMediaUploadHandler } from "./upload-day-media.js"

describe("createDayMediaUploadHandler", () => {
  it("uploads through the provider client baseUrl and fetcher", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        key: "uploads/day.png",
        url: "https://cdn.example/day.png",
        mimeType: "image/png",
        size: 12,
      }),
    )
    const upload = createDayMediaUploadHandler({
      baseUrl: "https://api.example.test/api/",
      fetcher,
    })

    const result = await upload(new File(["day"], "day.png", { type: "image/png" }), {
      productId: "prod_123",
      dayId: "day_123",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/uploads",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    )
    expect(result).toMatchObject({
      name: "day.png",
      storageKey: "uploads/day.png",
      mediaType: "image",
    })
  })
})
