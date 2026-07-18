/**
 * The `postMessage` protocol between the admin host and a sandboxed extension.
 *
 * Every message is an {@link UiExtensionEnvelope}: `{ v: 1, type, payload? }`
 * with a `"voyant:ext:*"` type. The version discriminator lets the host reject
 * foreign frames cheaply and lets a future protocol revision coexist. The
 * host posts with `targetOrigin: "*"` (an opaque-origin sandbox frame cannot
 * be addressed by origin) and both sides authenticate by `event.source`, not
 * by origin — safe in v1 because no secrets cross the boundary.
 */
import type { UiExtensionContext, UiExtensionToastIntent } from "./types.js"

/** Current envelope version. Bumped only on a breaking protocol change. */
export const UI_EXTENSION_PROTOCOL_VERSION = 1

/** Every protocol message type, namespaced to avoid clashing with app messages. */
export const uiExtensionMessageTypes = {
  /** extension → host: handshake, sent once the frame is ready for init. */
  ready: "voyant:ext:ready",
  /** extension → host: report desired content height in CSS pixels. */
  resize: "voyant:ext:resize",
  /** extension → host: request navigation to a relative admin path. */
  navigate: "voyant:ext:navigate",
  /** extension → host: raise a toast in the admin shell. */
  toast: "voyant:ext:toast",
  /**
   * extension → host: request a short-lived admin session token for the
   * current entity/slot context. The host answers with `token` (or `error`
   * with `not-supported`/`unavailable` when no broker is wired or issuance
   * fails). The token is NOT a Voyant API credential — the frame relays it to
   * its own backend, which exchanges it for online actor access.
   */
  requestToken: "voyant:ext:request-token",
  /** host → extension: initial context handed back after `ready`. */
  init: "voyant:ext:init",
  /** host → extension: context update (theme/locale/entity change). */
  context: "voyant:ext:context",
  /** host → extension: a short-lived admin session token (answers `request-token`). */
  sessionToken: "voyant:ext:session-token",
  /** host → extension: an error response (e.g. an unsupported request). */
  error: "voyant:ext:error",
} as const

export type UiExtensionMessageType =
  (typeof uiExtensionMessageTypes)[keyof typeof uiExtensionMessageTypes]

/** Bounds the host applies to a reported resize height, in CSS pixels. */
export const UI_EXTENSION_MIN_HEIGHT = 0
export const UI_EXTENSION_MAX_HEIGHT = 800
/** Maximum toast message length before the host truncates it. */
export const UI_EXTENSION_TOAST_MAX_LENGTH = 200

/** Base envelope shared by every message on the bus. */
export interface UiExtensionEnvelope<Type extends UiExtensionMessageType, Payload = undefined> {
  v: typeof UI_EXTENSION_PROTOCOL_VERSION
  type: Type
  payload: Payload
}

// --- extension → host -------------------------------------------------------

export type UiExtensionReadyMessage = UiExtensionEnvelope<"voyant:ext:ready">
export type UiExtensionResizeMessage = UiExtensionEnvelope<"voyant:ext:resize", { height: number }>
export type UiExtensionNavigateMessage = UiExtensionEnvelope<"voyant:ext:navigate", { to: string }>
export type UiExtensionToastMessage = UiExtensionEnvelope<
  "voyant:ext:toast",
  { intent: UiExtensionToastIntent; message: string }
>
export type UiExtensionRequestTokenMessage = UiExtensionEnvelope<
  "voyant:ext:request-token",
  { requestId?: string }
>

export type UiExtensionOutboundMessage =
  | UiExtensionReadyMessage
  | UiExtensionResizeMessage
  | UiExtensionNavigateMessage
  | UiExtensionToastMessage
  | UiExtensionRequestTokenMessage

// --- host → extension -------------------------------------------------------

export type UiExtensionInitMessage = UiExtensionEnvelope<
  "voyant:ext:init",
  {
    apiVersion: string
    slot: string
    context: UiExtensionContext
    config: Record<string, unknown>
  }
>
export type UiExtensionContextMessage = UiExtensionEnvelope<
  "voyant:ext:context",
  { context: UiExtensionContext }
>
/**
 * The short-lived admin session token delivered in response to `request-token`.
 * `expiresAt` is epoch milliseconds; `requestId` echoes the request when the
 * extension supplied one so concurrent requests can be correlated.
 */
export type UiExtensionTokenMessage = UiExtensionEnvelope<
  "voyant:ext:session-token",
  { token: string; tokenId: string; expiresAt: number; requestId?: string }
>
export type UiExtensionErrorMessage = UiExtensionEnvelope<
  "voyant:ext:error",
  { code: string; requestId?: string }
>

export type UiExtensionInboundMessage =
  | UiExtensionInitMessage
  | UiExtensionContextMessage
  | UiExtensionTokenMessage
  | UiExtensionErrorMessage

export type UiExtensionMessage = UiExtensionOutboundMessage | UiExtensionInboundMessage

// --- clamps -----------------------------------------------------------------

/** Clamp a reported height into the host's allowed `[0, 800]` range. */
export function clampUiExtensionHeight(height: number): number {
  if (Number.isNaN(height)) return UI_EXTENSION_MIN_HEIGHT
  return Math.min(UI_EXTENSION_MAX_HEIGHT, Math.max(UI_EXTENSION_MIN_HEIGHT, Math.round(height)))
}

/** Length-cap a toast message so a hostile extension cannot flood the shell. */
export function capUiExtensionToastMessage(message: string): string {
  return message.length > UI_EXTENSION_TOAST_MAX_LENGTH
    ? message.slice(0, UI_EXTENSION_TOAST_MAX_LENGTH)
    : message
}

// --- creators ---------------------------------------------------------------

export function createReadyMessage(): UiExtensionReadyMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.ready,
    payload: undefined,
  }
}

export function createResizeMessage(height: number): UiExtensionResizeMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.resize,
    payload: { height: clampUiExtensionHeight(height) },
  }
}

export function createNavigateMessage(to: string): UiExtensionNavigateMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.navigate,
    payload: { to },
  }
}

export function createToastMessage(
  intent: UiExtensionToastIntent,
  message: string,
): UiExtensionToastMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.toast,
    payload: { intent, message: capUiExtensionToastMessage(message) },
  }
}

export function createRequestTokenMessage(requestId?: string): UiExtensionRequestTokenMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.requestToken,
    payload: requestId ? { requestId } : {},
  }
}

export function createTokenMessage(
  payload: UiExtensionTokenMessage["payload"],
): UiExtensionTokenMessage {
  return { v: UI_EXTENSION_PROTOCOL_VERSION, type: uiExtensionMessageTypes.sessionToken, payload }
}

export function createInitMessage(
  payload: UiExtensionInitMessage["payload"],
): UiExtensionInitMessage {
  return { v: UI_EXTENSION_PROTOCOL_VERSION, type: uiExtensionMessageTypes.init, payload }
}

export function createContextMessage(context: UiExtensionContext): UiExtensionContextMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.context,
    payload: { context },
  }
}

export function createErrorMessage(code: string, requestId?: string): UiExtensionErrorMessage {
  return {
    v: UI_EXTENSION_PROTOCOL_VERSION,
    type: uiExtensionMessageTypes.error,
    payload: requestId ? { code, requestId } : { code },
  }
}

// --- guards -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Narrow an unknown `message` to a well-formed protocol envelope. */
export function isUiExtensionEnvelope(value: unknown): value is UiExtensionMessage {
  if (!isRecord(value)) return false
  if (value.v !== UI_EXTENSION_PROTOCOL_VERSION) return false
  return (
    typeof value.type === "string" &&
    (Object.values(uiExtensionMessageTypes) as string[]).includes(value.type)
  )
}

function isMessageOfType<T extends UiExtensionMessage>(
  value: unknown,
  type: UiExtensionMessageType,
): value is T {
  return isUiExtensionEnvelope(value) && value.type === type
}

export function isReadyMessage(value: unknown): value is UiExtensionReadyMessage {
  return isMessageOfType(value, uiExtensionMessageTypes.ready)
}

export function isResizeMessage(value: unknown): value is UiExtensionResizeMessage {
  return (
    isMessageOfType<UiExtensionResizeMessage>(value, uiExtensionMessageTypes.resize) &&
    isRecord(value.payload) &&
    typeof value.payload.height === "number"
  )
}

export function isNavigateMessage(value: unknown): value is UiExtensionNavigateMessage {
  return (
    isMessageOfType<UiExtensionNavigateMessage>(value, uiExtensionMessageTypes.navigate) &&
    isRecord(value.payload) &&
    typeof value.payload.to === "string"
  )
}

export function isToastMessage(value: unknown): value is UiExtensionToastMessage {
  return (
    isMessageOfType<UiExtensionToastMessage>(value, uiExtensionMessageTypes.toast) &&
    isRecord(value.payload) &&
    typeof value.payload.message === "string" &&
    (value.payload.intent === "info" ||
      value.payload.intent === "success" ||
      value.payload.intent === "error")
  )
}

export function isRequestTokenMessage(value: unknown): value is UiExtensionRequestTokenMessage {
  return isMessageOfType(value, uiExtensionMessageTypes.requestToken)
}

export function isInitMessage(value: unknown): value is UiExtensionInitMessage {
  return (
    isMessageOfType<UiExtensionInitMessage>(value, uiExtensionMessageTypes.init) &&
    isRecord(value.payload) &&
    typeof value.payload.apiVersion === "string" &&
    typeof value.payload.slot === "string" &&
    isRecord(value.payload.context)
  )
}

export function isContextMessage(value: unknown): value is UiExtensionContextMessage {
  return (
    isMessageOfType<UiExtensionContextMessage>(value, uiExtensionMessageTypes.context) &&
    isRecord(value.payload) &&
    isRecord(value.payload.context)
  )
}

export function isTokenMessage(value: unknown): value is UiExtensionTokenMessage {
  return (
    isMessageOfType<UiExtensionTokenMessage>(value, uiExtensionMessageTypes.sessionToken) &&
    isRecord(value.payload) &&
    typeof value.payload.token === "string" &&
    typeof value.payload.tokenId === "string" &&
    typeof value.payload.expiresAt === "number"
  )
}

export function isErrorMessage(value: unknown): value is UiExtensionErrorMessage {
  return (
    isMessageOfType<UiExtensionErrorMessage>(value, uiExtensionMessageTypes.error) &&
    isRecord(value.payload) &&
    typeof value.payload.code === "string"
  )
}
