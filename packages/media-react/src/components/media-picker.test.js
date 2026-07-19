// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime"
import { afterEach, describe, expect, it, vi } from "vitest"
import { VoyantMediaProvider } from "../provider.js"
import { MediaPicker } from "./media-picker.js"

const imageAsset = {
  id: "media_asset_img",
  type: "image",
  name: "Sunset photo",
  alt: "A sunset over the sea",
  storageKey: "uploads/sunset.jpg",
  mimeType: "image/jpeg",
  fileSize: 12_345,
  checksum: "sum-img",
  width: 800,
  height: 600,
  durationMs: null,
  tags: ["nature"],
  providerMeta: null,
  createdBy: "user_1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}
const videoAsset = {
  ...imageAsset,
  id: "media_asset_vid",
  type: "video",
  name: "Launch clip",
  alt: null,
  storageKey: "uploads/launch.mp4",
  mimeType: "video/mp4",
  checksum: "sum-vid",
}
function listResponse(data) {
  return { data, total: data.length, limit: 40, offset: 0 }
}
afterEach(() => {
  cleanup()
})
describe("MediaPicker", () => {
  it("renders assets returned by the library", async () => {
    const fetcher = fetcherFor([imageAsset, videoAsset])
    renderPicker({ fetcher, onSelect: vi.fn() })
    expect(await screen.findByText("Sunset photo")).toBeInstanceOf(HTMLElement)
    expect(screen.getByText("Launch clip")).toBeInstanceOf(HTMLElement)
  })
  it("filters by asset type through the type control", async () => {
    const fetcher = fetcherFor([imageAsset, videoAsset])
    renderPicker({ fetcher, onSelect: vi.fn() })
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "image" } })
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("/v1/admin/media-library/assets?type=image"),
        expect.anything(),
      ),
    )
  })
  it("fires onSelect with the chosen asset in single-select mode", async () => {
    const fetcher = fetcherFor([imageAsset, videoAsset])
    const onSelect = vi.fn()
    renderPicker({ fetcher, onSelect })
    fireEvent.click(await screen.findByText("Sunset photo"))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "media_asset_img" })])
  })
})
function fetcherFor(assets) {
  return vi.fn(async (url) => {
    const parsed = new URL(url, "http://localhost")
    const type = parsed.searchParams.get("type")
    if (parsed.pathname.endsWith("/media-library/assets")) {
      const filtered = type ? assets.filter((asset) => asset.type === type) : assets
      return Response.json(listResponse(filtered))
    }
    return Response.json(listResponse([]))
  })
}
function renderPicker({ fetcher, onSelect, children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    _jsx(QueryClientProvider, {
      client: queryClient,
      children: _jsxs(VoyantMediaProvider, {
        baseUrl: "/api",
        fetcher: fetcher,
        children: [_jsx(MediaPicker, { inline: true, onSelect: onSelect }), children],
      }),
    }),
  )
}
