/**
 * Author-facing client that runs INSIDE the sandboxed extension frame.
 *
 * `initUiExtension` performs the host handshake and resolves to a handle that
 * exposes the current context/config plus the small action surface an
 * extension is allowed to drive (navigate/toast/resize). Height is reported
 * automatically via a `ResizeObserver`, so most extensions never call
 * `actions.resize` themselves.
 */
import {
  createNavigateMessage,
  createReadyMessage,
  createRequestTokenMessage,
  createResizeMessage,
  createToastMessage,
  isContextMessage,
  isInitMessage,
  type UiExtensionOutboundMessage,
} from "./protocol.js"
import type { UiExtensionContext, UiExtensionToastIntent } from "./types.js"

/** Default handshake budget before `initUiExtension` rejects. */
export const UI_EXTENSION_HANDSHAKE_TIMEOUT_MS = 10_000

/**
 * The `ResizeObserver` constructor is a global, not a member of the `Window`
 * interface, so it is read through this narrow view (which also lets tests
 * inject a stub on the injected window).
 */
type WindowWithResizeObserver = Window & { ResizeObserver?: typeof ResizeObserver }

export interface InitUiExtensionOptions {
  /** Window the extension runs in. Defaults to the ambient `window`. */
  window?: Window
  /** Milliseconds to wait for the host `init` before rejecting. Defaults to 10s. */
  timeoutMs?: number
  /**
   * Element observed for automatic height reporting. Defaults to
   * `document.documentElement`. Pass `null` to disable automatic reporting.
   */
  resizeTarget?: Element | null
}

export interface UiExtensionActions {
  /** Ask the host to navigate to a RELATIVE admin path (validated host-side). */
  navigate(to: string): void
  /** Raise a toast in the admin shell. */
  toast(intent: UiExtensionToastIntent, message: string): void
  /** Report a desired content height (clamped to the host's bounds). */
  resize(px: number): void
}

export interface UiExtensionHandle {
  readonly context: UiExtensionContext
  readonly config: Record<string, unknown>
  readonly slot: string
  readonly apiVersion: string
  /** Subscribe to host context updates; returns an unsubscribe function. */
  onContextChange(listener: (context: UiExtensionContext) => void): () => void
  readonly actions: UiExtensionActions
  /** Tear down listeners and the resize observer. */
  destroy(): void
}

/**
 * Announce readiness to the host and resolve once it replies with `init`.
 *
 * Only messages whose `event.source` is `window.parent` are accepted, matching
 * the host's mirror-image `event.source === iframe.contentWindow` check.
 */
export function initUiExtension(options: InitUiExtensionOptions = {}): Promise<UiExtensionHandle> {
  const ambient = options.window ?? (typeof window === "undefined" ? undefined : window)
  if (!ambient?.parent || ambient.parent === ambient) {
    return Promise.reject(
      new Error("[voyant-ext] initUiExtension must run inside a host iframe with a parent window."),
    )
  }
  const win: Window = ambient
  const parent = win.parent
  const timeoutMs = options.timeoutMs ?? UI_EXTENSION_HANDSHAKE_TIMEOUT_MS

  return new Promise<UiExtensionHandle>((resolve, reject) => {
    const listeners = new Set<(context: UiExtensionContext) => void>()
    let context: UiExtensionContext | undefined
    let settled = false
    let resizeObserver: ResizeObserver | undefined

    const post = (message: UiExtensionOutboundMessage) => {
      parent.postMessage(message, "*")
    }

    const stopObserving = () => {
      resizeObserver?.disconnect()
      resizeObserver = undefined
    }

    const teardown = () => {
      win.removeEventListener("message", onMessage)
      stopObserving()
      win.clearTimeout(timer)
    }

    const startObserving = () => {
      const target =
        options.resizeTarget === undefined ? win.document?.documentElement : options.resizeTarget
      const ObserverCtor = (win as WindowWithResizeObserver).ResizeObserver
      if (!target || !ObserverCtor) return
      const report = () => post(createResizeMessage(target.getBoundingClientRect().height))
      resizeObserver = new ObserverCtor(report)
      resizeObserver.observe(target)
      report()
    }

    const actions: UiExtensionActions = {
      navigate: (to) => post(createNavigateMessage(to)),
      toast: (intent, message) => post(createToastMessage(intent, message)),
      resize: (px) => post(createResizeMessage(px)),
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== parent) return
      if (isInitMessage(event.data)) {
        if (settled) return
        settled = true
        win.clearTimeout(timer)
        context = event.data.payload.context
        startObserving()
        resolve({
          get context() {
            return context as UiExtensionContext
          },
          config: event.data.payload.config ?? {},
          slot: event.data.payload.slot,
          apiVersion: event.data.payload.apiVersion,
          onContextChange(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
          actions,
          destroy: teardown,
        })
        return
      }
      if (isContextMessage(event.data) && settled) {
        context = event.data.payload.context
        for (const listener of listeners) listener(context)
      }
    }

    const timer = win.setTimeout(() => {
      if (settled) return
      settled = true
      teardown()
      reject(new Error("[voyant-ext] Timed out waiting for the admin host to initialize."))
    }, timeoutMs)

    win.addEventListener("message", onMessage)
    post(createReadyMessage())
  })
}

/** Re-exported so extensions can send the reserved token request explicitly. */
export { createRequestTokenMessage }
