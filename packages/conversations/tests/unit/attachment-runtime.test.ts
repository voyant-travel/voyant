import { describe, expect, it, vi } from "vitest"
import { createDocumentsConversationAttachmentRuntime } from "../../src/attachment-runtime.js"

describe("documents attachment runtime", () => {
  it("fails closed when the private store cannot issue short-lived URLs", () => {
    expect(
      createDocumentsConversationAttachmentRuntime({
        resolve: () => ({
          name: "private",
          upload: vi.fn(),
          delete: vi.fn(),
          get: vi.fn(),
        }),
      }),
    ).toBeNull()
  })

  it("uses expiring private URLs without calling buffered get", async () => {
    const get = vi.fn()
    const signedUrl = vi.fn(async () => "https://private.invalid/short-lived")
    const runtime = createDocumentsConversationAttachmentRuntime({
      resolve: () => ({
        name: "private",
        upload: vi.fn(),
        delete: vi.fn(),
        get,
        signedUrl,
      }),
    })
    await expect(runtime?.download("stable-handle")).resolves.toMatchObject({
      kind: "redirect",
      url: "https://private.invalid/short-lived",
    })
    await expect(runtime?.resolveForSend("stable-handle")).resolves.toMatchObject({
      kind: "private-url",
      url: "https://private.invalid/short-lived",
    })
    expect(signedUrl).toHaveBeenNthCalledWith(1, "stable-handle", 60)
    expect(signedUrl).toHaveBeenNthCalledWith(2, "stable-handle", 60)
    expect(get).not.toHaveBeenCalled()
  })
})
