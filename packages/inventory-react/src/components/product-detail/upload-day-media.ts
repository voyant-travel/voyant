import type { VoyantFetcher } from "../../client.js"
import type { ProductMediaUploadHandler } from "../product-media-section.js"

export interface DayMediaUploadClient {
  baseUrl: string
  fetcher: VoyantFetcher
}

export function createDayMediaUploadHandler({
  baseUrl,
  fetcher,
}: DayMediaUploadClient): ProductMediaUploadHandler {
  return async (file) => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetcher(joinUrl(baseUrl, "/v1/admin/uploads"), {
      method: "POST",
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload failed (${res.status})`)
    const upload = (await res.json()) as {
      key: string
      url: string
      mimeType: string
      size: number
    }
    const mediaType: "image" | "video" | "document" = upload.mimeType.startsWith("video/")
      ? "video"
      : upload.mimeType.startsWith("image/")
        ? "image"
        : "document"
    return {
      url: upload.url,
      name: file.name,
      storageKey: upload.key,
      mimeType: upload.mimeType,
      fileSize: upload.size,
      mediaType,
    }
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}
