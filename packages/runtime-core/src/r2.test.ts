import { describe, expect, it } from "vitest"

import { createR2BucketShim, type R2Fetch } from "./r2.js"

interface Recorded {
  url: string
  method: string
  headers: Record<string, string>
  body?: BodyInit | null
}

function mockFetch(
  responder: (rec: Recorded) => {
    status?: number
    body?: BodyInit
    headers?: Record<string, string>
  },
): { fetch: R2Fetch; calls: Recorded[] } {
  const calls: Recorded[] = []
  const fetch: R2Fetch = async (input, init = {}) => {
    const rec: Recorded = {
      url: String(input),
      method: init.method ?? "GET",
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body,
    }
    calls.push(rec)
    const { status = 200, body, headers } = responder(rec)
    return new Response(body ?? null, { status, headers })
  }
  return { fetch, calls }
}

const base = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  bucket: "documents",
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret",
  region: "auto",
}

describe("createR2BucketShim", () => {
  it("PUTs a signed, path-style object URL with content-type and custom metadata", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 200 }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })

    await bucket.put("invoices/2026/x.pdf", "PDFDATA", {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { Owner: "acme" },
    })

    const call = calls[0]!
    expect(call.method).toBe("PUT")
    expect(call.url).toBe("https://acct.r2.cloudflarestorage.com/documents/invoices/2026/x.pdf")
    expect(call.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA_TEST\//)
    expect(call.headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/)
    expect(call.headers["content-type"]).toBe("application/pdf")
    expect(call.headers["x-amz-meta-owner"]).toBe("acme")
  })

  it("GETs an object exposing arrayBuffer, body, size, and httpMetadata", async () => {
    const { fetch } = mockFetch(() => ({
      body: "file-bytes",
      headers: { "content-type": "text/plain", "x-amz-meta-tag": "v1" },
    }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })

    const obj = await bucket.get("a.txt")
    expect(obj).not.toBeNull()
    const bytes = new Uint8Array(await obj!.arrayBuffer())
    expect(new TextDecoder().decode(bytes)).toBe("file-bytes")
    expect(obj!.httpMetadata?.contentType).toBe("text/plain")
    expect(obj!.customMetadata?.tag).toBe("v1")
    expect(obj!.body).toBeInstanceOf(ReadableStream)
  })

  it("returns null when the object is missing (404)", async () => {
    const { fetch } = mockFetch(() => ({ status: 404 }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })
    expect(await bucket.get("missing")).toBeNull()
  })

  it("DELETEs and tolerates a 404", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 404 }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })
    await expect(bucket.delete("gone")).resolves.toBeUndefined()
    expect(calls[0]?.method).toBe("DELETE")
  })

  it("supports array delete keys", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 204 }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })
    await bucket.delete(["a", "b"])
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "DELETE"])
  })

  it("HEAD returns metadata without a body", async () => {
    const { fetch } = mockFetch(() => ({
      headers: { "content-type": "image/png", "content-length": "1024" },
    }))
    const bucket = createR2BucketShim({ ...base, fetchImpl: fetch })
    const meta = await bucket.head("img.png")
    expect(meta?.httpMetadata?.contentType).toBe("image/png")
    expect(meta?.size).toBe(1024)
  })
})
