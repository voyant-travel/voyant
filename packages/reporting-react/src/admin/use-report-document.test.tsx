// @vitest-environment jsdom

import type { ReportDraft } from "@voyant-travel/reporting-contracts"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ReportDefinitionRow, UpdateReportInput } from "./api.js"
import { VoyantApiError } from "./client.js"
import {
  type ReportDocumentAdapter,
  type ReportDocumentController,
  type ReportDocumentSnapshot,
  useReportDocument,
} from "./use-report-document.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const draftWith = (widgetId: string): ReportDraft => ({
  parameters: {},
  widgets: [
    {
      id: widgetId,
      source: { kind: "preset", widgetId: "bookings.total" },
      layout: { x: 0, y: 0, width: 3, height: 2 },
    },
  ],
})

const row = (over: Partial<ReportDefinitionRow>): ReportDefinitionRow => ({
  id: "rep_1",
  name: "Report",
  description: null,
  sourceTemplateId: null,
  sourceTemplateVersion: null,
  draft: { parameters: {}, widgets: [] },
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

const baseline: ReportDocumentSnapshot = {
  draft: { parameters: {}, widgets: [] },
  name: "Report",
  description: null,
  revision: 1,
}

function mount(adapter: ReportDocumentAdapter, initial = baseline, autosaveDelayMs = 800) {
  const container = document.createElement("div")
  let root: Root
  const ref: { current: ReportDocumentController | null } = { current: null }
  function Harness() {
    ref.current = useReportDocument(initial, adapter, { autosaveDelayMs })
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
  return { get, unmount: () => act(() => root.unmount()) }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useReportDocument", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("autosaves the full draft via a revision-guarded PATCH and adopts the new revision", async () => {
    const save = vi.fn(async (input: UpdateReportInput) => row({ revision: input.revision + 1 }))
    const adapter: ReportDocumentAdapter = { save, reload: vi.fn(async () => row({})) }
    const { get, unmount } = mount(adapter)

    act(() => get().setDraft(draftWith("w-1")))
    expect(get().isDirty).toBe(true)
    act(() => vi.advanceTimersByTime(800))
    await flushMicrotasks()

    expect(save).toHaveBeenCalledTimes(1)
    const input = save.mock.calls[0]?.[0]
    expect(input?.revision).toBe(1)
    // The complete draft is persisted, not just layout rectangles.
    expect(input?.draft?.widgets[0]).toMatchObject({
      id: "w-1",
      source: { kind: "preset", widgetId: "bookings.total" },
    })
    expect(get().status).toBe("saved")
    expect(get().revision).toBe(2)
    expect(get().isDirty).toBe(false)
    unmount()
  })

  it("surfaces a 409 as a conflict status without discarding the draft", async () => {
    const save = vi.fn(async () => {
      throw new VoyantApiError("revision_conflict", 409, { error: "revision_conflict" })
    })
    const adapter: ReportDocumentAdapter = { save, reload: vi.fn(async () => row({})) }
    const { get, unmount } = mount(adapter)

    act(() => get().setName("Renamed"))
    act(() => vi.advanceTimersByTime(800))
    await flushMicrotasks()

    expect(get().status).toBe("conflict")
    expect(get().isDirty).toBe(true)
    unmount()
  })

  it("resolves a conflict by reloading the authoritative server copy", async () => {
    const save = vi.fn(async () => {
      throw new VoyantApiError("revision_conflict", 409, {})
    })
    const reload = vi.fn(async () =>
      row({ revision: 7, name: "Server name", draft: draftWith("server-widget") }),
    )
    const { get, unmount } = mount({ save, reload })

    act(() => get().setName("Local name"))
    act(() => vi.advanceTimersByTime(800))
    await flushMicrotasks()
    expect(get().status).toBe("conflict")

    await act(async () => {
      await get().resolveConflict("reload")
    })
    expect(get().name).toBe("Server name")
    expect(get().revision).toBe(7)
    expect(get().draft.widgets[0]?.id).toBe("server-widget")
    unmount()
  })

  it("resolves a conflict by overwriting on top of the latest revision", async () => {
    let attempt = 0
    const save = vi.fn(async (input: UpdateReportInput) => {
      attempt += 1
      if (attempt === 1) throw new VoyantApiError("revision_conflict", 409, {})
      return row({ revision: input.revision + 1, name: input.name })
    })
    const reload = vi.fn(async () => row({ revision: 9 }))
    const { get, unmount } = mount({ save, reload })

    act(() => get().setName("Local name"))
    act(() => vi.advanceTimersByTime(800))
    await flushMicrotasks()
    expect(get().status).toBe("conflict")

    await act(async () => {
      await get().resolveConflict("overwrite")
    })
    // The retried save is guarded against the server's latest revision (9).
    expect(save.mock.calls[1]?.[0]?.revision).toBe(9)
    expect(save.mock.calls[1]?.[0]?.name).toBe("Local name")
    expect(get().status).toBe("saved")
    expect(get().revision).toBe(10)
    unmount()
  })
})
