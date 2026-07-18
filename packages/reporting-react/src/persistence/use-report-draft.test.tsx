// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LayoutItem, ReportLayout, ReportPersistenceAdapter } from "../types.js"
import { type ReportDraftController, useReportDraft } from "./use-report-draft.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const layout = (widgetId: string): ReportLayout => ({
  items: [{ widgetId, x: 0, y: 0, width: 4, height: 2 }],
})

const items = (widgetId: string): LayoutItem[] => [{ widgetId, x: 1, y: 1, width: 3, height: 2 }]

function mountDraft(
  adapter: ReportPersistenceAdapter,
  initial: ReportLayout,
  autosaveDelayMs = 800,
) {
  const container = document.createElement("div")
  let root: Root
  const ref: { current: ReportDraftController | null } = { current: null }

  function Harness() {
    ref.current = useReportDraft(initial, adapter, { autosaveDelayMs })
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(<Harness />)
  })

  const get = () => {
    if (!ref.current) throw new Error("controller not mounted")
    return ref.current
  }
  const unmount = () => act(() => root.unmount())
  return { get, unmount }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useReportDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("updates the optimistic draft immediately and stays dirty until saved", () => {
    const adapter: ReportPersistenceAdapter = { save: vi.fn(async () => {}) }
    const { get, unmount } = mountDraft(adapter, layout("a"))

    act(() => get().setItems(items("a")))

    expect(get().draft.items[0]).toMatchObject({ x: 1, y: 1 })
    expect(get().isDirty).toBe(true)
    expect(adapter.save).not.toHaveBeenCalled() // debounced, not yet fired
    unmount()
  })

  it("debounces autosave and transitions idle -> saving -> saved", async () => {
    const gate = deferred<void>()
    const save = vi.fn(() => gate.promise)
    const { get, unmount } = mountDraft({ save }, layout("a"))

    act(() => get().setItems(items("a")))
    act(() => {
      vi.advanceTimersByTime(799)
    })
    expect(save).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(get().status).toBe("saving")

    gate.resolve()
    await flushMicrotasks()

    expect(get().status).toBe("saved")
    expect(get().isDirty).toBe(false)
    unmount()
  })

  it("coalesces rapid edits into a single save", () => {
    const save = vi.fn(async (_layout: ReportLayout) => {})
    const { get, unmount } = mountDraft({ save }, layout("a"))

    act(() => get().setItems(items("a")))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => get().setItems([{ widgetId: "a", x: 2, y: 2, width: 3, height: 2 }]))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // First timer was reset by the second edit — no save yet.
    expect(save).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0]).toEqual({
      items: [{ widgetId: "a", x: 2, y: 2, width: 3, height: 2 }],
    })
    unmount()
  })

  it("surfaces an error status and keeps the draft dirty when a save fails", async () => {
    const gate = deferred<void>()
    const save = vi.fn(() => gate.promise)
    const { get, unmount } = mountDraft({ save }, layout("a"))

    act(() => get().setItems(items("a")))
    act(() => {
      vi.advanceTimersByTime(800)
    })
    gate.reject(new Error("network down"))
    await flushMicrotasks()

    expect(get().status).toBe("error")
    expect(get().error?.message).toBe("network down")
    expect(get().isDirty).toBe(true)
    unmount()
  })

  it("flush() saves immediately without waiting for the debounce", async () => {
    const gate = deferred<void>()
    const save = vi.fn(() => gate.promise)
    const { get, unmount } = mountDraft({ save }, layout("a"))

    act(() => get().setItems(items("a")))
    let flushed: Promise<void>
    act(() => {
      flushed = get().flush()
    })
    expect(save).toHaveBeenCalledTimes(1)

    gate.resolve()
    await act(async () => {
      await flushed
    })
    expect(get().status).toBe("saved")
    unmount()
  })
})
