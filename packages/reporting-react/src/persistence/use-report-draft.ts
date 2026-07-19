import { useCallback, useEffect, useRef, useState } from "react"
import type { LayoutItem, ReportLayout, ReportPersistenceAdapter, SaveStatus } from "../types.js"

export const DEFAULT_AUTOSAVE_DELAY_MS = 800

export interface UseReportDraftOptions {
  /** Debounce window for autosave, in milliseconds. */
  readonly autosaveDelayMs?: number
  /** Notified whenever the save status transitions. */
  readonly onStatusChange?: (status: SaveStatus) => void
}

export interface ReportDraftController {
  /** The optimistic local draft. Always reflects the latest local edit. */
  readonly draft: ReportLayout
  /** Autosave lifecycle status. */
  readonly status: SaveStatus
  /** The most recent save error, if `status === "error"`. */
  readonly error: Error | null
  /** Whether there are local edits not yet persisted to the server. */
  readonly isDirty: boolean
  /** Replace the layout items; schedules a debounced autosave. */
  readonly setItems: (items: readonly LayoutItem[]) => void
  /** Persist immediately, cancelling any pending debounced save. */
  readonly flush: () => Promise<void>
  /** Adopt a fresh server layout as the new clean baseline. */
  readonly reset: (layout: ReportLayout) => void
}

/**
 * Owns the optimistic local draft and the debounced autosave loop.
 *
 * The server is always the source of truth: this hook keeps an in-memory
 * optimistic copy and pushes changes to the typed adapter, but it never writes
 * to `localStorage` or treats browser storage as authoritative. If a save
 * fails, the draft is preserved (still dirty) so the next edit or an explicit
 * {@link ReportDraftController.flush} can retry.
 */
export function useReportDraft(
  initial: ReportLayout,
  adapter: ReportPersistenceAdapter,
  options: UseReportDraftOptions = {},
): ReportDraftController {
  const { autosaveDelayMs = DEFAULT_AUTOSAVE_DELAY_MS, onStatusChange } = options

  const [draft, setDraft] = useState<ReportLayout>(initial)
  const [status, setStatusState] = useState<SaveStatus>("idle")
  const [error, setError] = useState<Error | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Refs let the debounced callback always see the latest values without
  // re-arming the timer on every render.
  const draftRef = useRef(draft)
  const adapterRef = useRef(adapter)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const statusChangeRef = useRef(onStatusChange)

  draftRef.current = draft
  adapterRef.current = adapter
  statusChangeRef.current = onStatusChange

  const setStatus = useCallback((next: SaveStatus) => {
    setStatusState(next)
    statusChangeRef.current?.(next)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const runSave = useCallback(async (): Promise<void> => {
    clearTimer()
    const seq = ++saveSeqRef.current
    const snapshot = draftRef.current
    if (mountedRef.current) {
      setStatus("saving")
      setError(null)
    }
    try {
      await adapterRef.current.save(snapshot)
      if (!mountedRef.current || seq !== saveSeqRef.current) return
      // Only mark clean/saved if no newer edit superseded this save.
      setIsDirty(false)
      setStatus("saved")
    } catch (caught) {
      if (!mountedRef.current || seq !== saveSeqRef.current) return
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setStatus("error")
    }
  }, [clearTimer, setStatus])

  const setItems = useCallback(
    (items: readonly LayoutItem[]) => {
      const next: ReportLayout = { items: [...items] }
      draftRef.current = next
      setDraft(next)
      setIsDirty(true)
      clearTimer()
      timerRef.current = setTimeout(() => {
        void runSave()
      }, autosaveDelayMs)
    },
    [autosaveDelayMs, clearTimer, runSave],
  )

  const flush = useCallback(async () => {
    await runSave()
  }, [runSave])

  const reset = useCallback(
    (layout: ReportLayout) => {
      clearTimer()
      // Invalidate any in-flight save so its late resolution can't dirty the
      // freshly adopted baseline.
      saveSeqRef.current++
      draftRef.current = layout
      setDraft(layout)
      setIsDirty(false)
      setError(null)
      setStatus("idle")
    },
    [clearTimer, setStatus],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  return { draft, status, error, isDirty, setItems, flush, reset }
}
