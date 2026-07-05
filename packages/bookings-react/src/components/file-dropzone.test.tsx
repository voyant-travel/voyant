// @vitest-environment jsdom

import { type VoyantFetcher, VoyantReactProvider } from "@voyant-travel/react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FileDropzone } from "./file-dropzone.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe("FileDropzone", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("uploads through the provider client by default", async () => {
    const fetcher = vi.fn<VoyantFetcher>(async () =>
      Response.json({
        key: "uploads/passport.pdf",
        url: "https://cdn.example/passport.pdf",
        mimeType: "application/pdf",
        size: 20,
      }),
    )
    const onUploaded = vi.fn()

    await act(async () => {
      root.render(
        <VoyantReactProvider baseUrl="https://api.example.test/api/" fetcher={fetcher}>
          <FileDropzone onUploaded={onUploaded} />
        </VoyantReactProvider>,
      )
    })

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error("expected file input")
    const file = new File(["passport"], "passport.pdf", { type: "application/pdf" })

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      })
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/admin/uploads",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    )
    expect(onUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "passport.pdf",
        key: "uploads/passport.pdf",
      }),
    )
  })
})
