import { describe, expect, it } from "vitest"
import { fetchProtectedManifest } from "./ingestion.js"
import { validManifest } from "./test-fixtures.js"

const manifestResponse = (contentType = "application/json") =>
  new Response(JSON.stringify(validManifest), {
    headers: { "content-type": contentType },
  })

describe("protected manifest ingestion", () => {
  it("fetches HTTPS JSON through public DNS and parses bounded content", async () => {
    const fetcher: typeof fetch = async () => manifestResponse()

    await expect(
      fetchProtectedManifest("https://app.example.com/manifest.json", {
        fetch: fetcher as typeof fetch,
        resolveHost: async () => ["203.0.113.10"],
      }),
    ).resolves.toMatchObject({ contentType: "application/json", body: validManifest })
  })

  it("rejects private DNS answers, unsafe redirects, oversize bodies, and content types", async () => {
    await expect(
      fetchProtectedManifest("https://app.example.com/manifest.json", {
        fetch: async () => {
          throw new Error("private DNS should fail before fetch")
        },
        resolveHost: async () => ["127.0.0.1"],
      }),
    ).rejects.toThrow(/private or reserved/)

    await expect(
      fetchProtectedManifest("https://app.example.com/manifest.json", {
        fetch: async () =>
          new Response(null, { status: 302, headers: { location: "http://evil.test" } }),
        resolveHost: async () => ["203.0.113.10"],
      }),
    ).rejects.toThrow(/HTTPS/)

    await expect(
      fetchProtectedManifest("https://app.example.com/manifest.json", {
        fetch: async () => manifestResponse("text/plain"),
        resolveHost: async () => ["203.0.113.10"],
      }),
    ).rejects.toThrow(/content-type/)

    await expect(
      fetchProtectedManifest("https://app.example.com/manifest.json", {
        fetch: async () => manifestResponse(),
        maxBytes: 8,
        resolveHost: async () => ["203.0.113.10"],
      }),
    ).rejects.toThrow(/maximum allowed size/)
  })

  it("rejects DNS rebinding between the public pre-check and the pinned connect", async () => {
    let resolutions = 0
    await expect(
      fetchProtectedManifest("https://app.example.invalid/manifest.json", {
        timeoutMs: 2000,
        resolveHost: async () => {
          resolutions += 1
          return resolutions === 1 ? ["203.0.113.10"] : ["10.0.0.7"]
        },
      }),
    ).rejects.toThrow(/private or reserved/)
    expect(resolutions).toBeGreaterThanOrEqual(2)
  })
})
