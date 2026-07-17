import { describe, expect, it } from "vitest"
import type { UiExtensionContext } from "../../src/index.js"
import {
  capUiExtensionToastMessage,
  clampUiExtensionHeight,
  createContextMessage,
  createErrorMessage,
  createInitMessage,
  createNavigateMessage,
  createReadyMessage,
  createRequestTokenMessage,
  createResizeMessage,
  createToastMessage,
  createTokenMessage,
  isContextMessage,
  isErrorMessage,
  isInitMessage,
  isNavigateMessage,
  isReadyMessage,
  isRequestTokenMessage,
  isResizeMessage,
  isToastMessage,
  isTokenMessage,
  isUiExtensionEnvelope,
  UI_EXTENSION_MAX_HEIGHT,
  UI_EXTENSION_MIN_HEIGHT,
  UI_EXTENSION_PROTOCOL_VERSION,
  UI_EXTENSION_TOAST_MAX_LENGTH,
} from "../../src/index.js"

const context: UiExtensionContext = {
  org: { slug: "acme", name: "Acme Travel" },
  viewer: { id: "usr_1", displayName: "Ada" },
  entity: null,
  theme: "light",
  locale: "en",
  appLocale: "en",
  direction: "ltr",
}

describe("clampUiExtensionHeight", () => {
  it("clamps into the [0, 800] range and rounds", () => {
    expect(clampUiExtensionHeight(-40)).toBe(UI_EXTENSION_MIN_HEIGHT)
    expect(clampUiExtensionHeight(10_000)).toBe(UI_EXTENSION_MAX_HEIGHT)
    expect(clampUiExtensionHeight(123.6)).toBe(124)
  })

  it("falls back to the minimum for non-finite input", () => {
    expect(clampUiExtensionHeight(Number.NaN)).toBe(UI_EXTENSION_MIN_HEIGHT)
    expect(clampUiExtensionHeight(Number.POSITIVE_INFINITY)).toBe(UI_EXTENSION_MAX_HEIGHT)
  })
})

describe("capUiExtensionToastMessage", () => {
  it("truncates past the max length", () => {
    const long = "x".repeat(UI_EXTENSION_TOAST_MAX_LENGTH + 50)
    expect(capUiExtensionToastMessage(long)).toHaveLength(UI_EXTENSION_TOAST_MAX_LENGTH)
    expect(capUiExtensionToastMessage("hi")).toBe("hi")
  })
})

describe("message creators", () => {
  it("stamp the envelope version and clamp/cap payloads", () => {
    expect(createReadyMessage()).toEqual({
      v: UI_EXTENSION_PROTOCOL_VERSION,
      type: "voyant:ext:ready",
      payload: undefined,
    })
    expect(createResizeMessage(9999).payload.height).toBe(UI_EXTENSION_MAX_HEIGHT)
    expect(createToastMessage("error", "y".repeat(400)).payload.message).toHaveLength(
      UI_EXTENSION_TOAST_MAX_LENGTH,
    )
    expect(createNavigateMessage("/bookings").payload.to).toBe("/bookings")
  })
})

describe("type guards", () => {
  it("accept well-formed messages", () => {
    expect(isReadyMessage(createReadyMessage())).toBe(true)
    expect(isResizeMessage(createResizeMessage(100))).toBe(true)
    expect(isNavigateMessage(createNavigateMessage("/x"))).toBe(true)
    expect(isToastMessage(createToastMessage("info", "hi"))).toBe(true)
    expect(
      isInitMessage(createInitMessage({ apiVersion: "1.0.0", slot: "s", context, config: {} })),
    ).toBe(true)
    expect(isContextMessage(createContextMessage(context))).toBe(true)
    expect(isErrorMessage(createErrorMessage("not-supported"))).toBe(true)
    expect(isRequestTokenMessage(createRequestTokenMessage())).toBe(true)
    expect(isRequestTokenMessage(createRequestTokenMessage("tok-1"))).toBe(true)
    expect(
      isTokenMessage(
        createTokenMessage({
          token: "vsess_x",
          tokenId: "st_1",
          expiresAt: 1000,
          requestId: "tok-1",
        }),
      ),
    ).toBe(true)
  })

  it("carry and echo the request correlation id", () => {
    expect(createRequestTokenMessage("tok-7").payload).toEqual({ requestId: "tok-7" })
    expect(createRequestTokenMessage().payload).toEqual({})
    expect(createErrorMessage("unavailable", "tok-7").payload).toEqual({
      code: "unavailable",
      requestId: "tok-7",
    })
  })

  it("reject malformed token envelopes", () => {
    expect(
      isTokenMessage({ v: 1, type: "voyant:ext:session-token", payload: { token: "x" } }),
    ).toBe(false)
    expect(isTokenMessage(createContextMessage(context))).toBe(false)
  })

  it("reject foreign, wrong-version, and malformed envelopes", () => {
    expect(isUiExtensionEnvelope({ type: "voyant:ext:ready" })).toBe(false)
    expect(isUiExtensionEnvelope({ v: 2, type: "voyant:ext:ready" })).toBe(false)
    expect(isUiExtensionEnvelope({ v: 1, type: "other:message" })).toBe(false)
    expect(isUiExtensionEnvelope(null)).toBe(false)
    expect(isResizeMessage({ v: 1, type: "voyant:ext:resize", payload: {} })).toBe(false)
    expect(
      isToastMessage({ v: 1, type: "voyant:ext:toast", payload: { intent: "warn", message: "x" } }),
    ).toBe(false)
    expect(isReadyMessage(createResizeMessage(1))).toBe(false)
  })
})
