import { describe, expect, it, vi } from "vitest"

import {
  assertPublicWebhookEndpoint,
  createPinnedWebhookFetch,
  UnsafeWebhookEndpointError,
} from "../src/protected-fetch.js"

describe("protected webhook transport", () => {
  it.each([
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "2001::1",
    "2001:2::1",
    "2001:db8::1",
    "2002:0808:0808::1",
    "3fff::1",
  ])("rejects non-public IPv6 address %s returned by DNS", async (address) => {
    await expect(
      assertPublicWebhookEndpoint("https://receiver.example.test/hooks", async () => [address]),
    ).rejects.toBeInstanceOf(UnsafeWebhookEndpointError)
  })

  it.each([
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "198.51.100.1",
    "203.0.113.1",
  ])("rejects reserved IPv4 address %s returned by DNS", async (address) => {
    await expect(
      assertPublicWebhookEndpoint("https://receiver.example.test/hooks", async () => [address]),
    ).rejects.toBeInstanceOf(UnsafeWebhookEndpointError)
  })

  it("allows native public global-unicast IPv6 addresses", async () => {
    await expect(
      assertPublicWebhookEndpoint("https://receiver.example.test/hooks", async () => [
        "2606:4700:4700::1111",
      ]),
    ).resolves.toBeUndefined()
  })

  it("enforces the address policy inside the real pinned HTTPS transport lookup", async () => {
    const resolveHost = vi.fn(async () => ["::ffff:169.254.169.254"])
    const pinnedFetch = createPinnedWebhookFetch(resolveHost)

    await expect(
      pinnedFetch("https://receiver.example.test/hooks", {
        method: "POST",
        body: "{}",
      }),
    ).rejects.toBeInstanceOf(UnsafeWebhookEndpointError)
    expect(resolveHost).toHaveBeenCalledWith("receiver.example.test")
  })
})
