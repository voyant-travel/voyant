// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { jsx as _jsx } from "react/jsx-runtime"
import { afterEach, describe, expect, it, vi } from "vitest"
import { VoyantMediaProvider } from "../provider.js"
import { MediaLibrary } from "./media-library.js"

const asset = {
  id: "media_asset_doc",
  type: "document",
  name: "Trip brochure",
  alt: null,
  storageKey: "uploads/brochure.pdf",
  mimeType: "application/pdf",
  fileSize: 98_765,
  checksum: "sum-doc",
  width: null,
  height: null,
  durationMs: null,
  tags: [],
  providerMeta: null,
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}
function listResponse(data) {
  return { data, total: data.length, limit: 60, offset: 0 }
}
afterEach(() => {
  cleanup()
})
describe("MediaLibrary", () => {
  it("renders the mocked asset list", async () => {
    const fetcher = vi.fn(async (url) => {
      const parsed = new URL(url, "http://localhost")
      if (parsed.pathname.endsWith("/media-library/assets")) {
        return Response.json(listResponse([asset]))
      }
      // folders + usage endpoints
      return Response.json(listResponse([]))
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      _jsx(QueryClientProvider, {
        client: queryClient,
        children: _jsx(VoyantMediaProvider, {
          baseUrl: "/api",
          fetcher: fetcher,
          children: _jsx(MediaLibrary, {}),
        }),
      }),
    )
    expect(await screen.findByText("Trip brochure")).toBeInstanceOf(HTMLElement)
    expect(screen.getByText("Media library")).toBeInstanceOf(HTMLElement)
  })
})
