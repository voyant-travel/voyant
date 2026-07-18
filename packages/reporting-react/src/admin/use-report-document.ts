import type { ReportDraft } from "@voyant-travel/reporting-contracts"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReportDefinitionRow, UpdateReportInput } from "./api.js"
import { VoyantApiError } from "./client.js"

export const DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS = 800

/**
 * `conflict` is distinct from `error`: it means the server rejected the save
 * because the report changed underneath us (optimistic-concurrency 409), so the
 * UI must offer an explicit reload/overwrite rather than a blind retry.
 */
export type ReportDocumentStatus = "idle" | "saving" | "saved" | "error" | "conflict"

/** The subset of a report row the document controller reads and writes. */
export interface ReportDocumentSnapshot {
  revision: number
  name: string
  description: string | null
  draft: ReportDraft
}

/**
 * Persistence seam for the document. `save` performs the revision-guarded PATCH
 * and returns the new row; `reload` re-reads the authoritative server row (used
 * to resolve conflicts). Injecting these keeps the hook decoupled from the API
 * client and unit-testable.
 */
export interface ReportDocumentAdapter {
  save: (input: UpdateReportInput) => Promise<ReportDefinitionRow>
  reload: () => Promise<ReportDefinitionRow>
}

export interface ReportDocumentController {
  readonly draft: ReportDraft
  readonly name: string
  readonly description: string | null
  readonly revision: number
  readonly status: ReportDocumentStatus
  readonly error: Error | null
  readonly isDirty: boolean
  /** Replace the draft via an updater; schedules a debounced autosave. */
  readonly updateDraft: (updater: (draft: ReportDraft) => ReportDraft) => void
  /** Replace the draft outright; schedules a debounced autosave. */
  readonly setDraft: (draft: ReportDraft) => void
  readonly setName: (name: string) => void
  readonly setDescription: (description: string | null) => void
  /** Persist immediately, cancelling any pending debounced save. */
  readonly flush: () => Promise<void>
  /** Adopt an authoritative server row as the new clean baseline. */
  readonly adopt: (row: ReportDocumentSnapshot) => void
  /**
   * Resolve a `conflict`: `reload` discards local edits for the server copy;
   * `overwrite` reapplies local edits on top of the server's latest revision.
   */
  readonly resolveConflict: (strategy: "reload" | "overwrite") => Promise<void>
}

interface DocumentState {
  draft: ReportDraft
  name: string
  description: string | null
  revision: number
}

export interface UseReportDocumentOptions {
  readonly autosaveDelayMs?: number
  readonly onStatusChange?: (status: ReportDocumentStatus) => void
}

/**
 * Owns the full {@link ReportDraft} (sources, custom definitions, titles,
 * layout) plus name/description and the optimistic-concurrency revision, and
 * drives the debounced autosave PATCH. The server remains the source of truth:
 * a failed save keeps the draft dirty, and a 409 surfaces as `conflict` for
 * explicit resolution.
 */
export function useReportDocument(
  initial: ReportDocumentSnapshot,
  adapter: ReportDocumentAdapter,
  options: UseReportDocumentOptions = {},
): ReportDocumentController {
  const { autosaveDelayMs = DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS, onStatusChange } = options

  const [state, setState] = useState<DocumentState>({
    draft: initial.draft,
    name: initial.name,
    description: initial.description,
    revision: initial.revision,
  })
  const [status, setStatusState] = useState<ReportDocumentStatus>("idle")
  const [error, setError] = useState<Error | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const stateRef = useRef(state)
  const adapterRef = useRef(adapter)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const statusChangeRef = useRef(onStatusChange)

  stateRef.current = state
  adapterRef.current = adapter
  statusChangeRef.current = onStatusChange

  const setStatus = useCallback((next: ReportDocumentStatus) => {
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
    const snapshot = stateRef.current
    if (mountedRef.current) {
      setStatus("saving")
      setError(null)
    }
    try {
      const row = await adapterRef.current.save({
        revision: snapshot.revision,
        name: snapshot.name,
        description: snapshot.description,
        draft: snapshot.draft,
      })
      if (!mountedRef.current || seq !== saveSeqRef.current) return
      // Adopt the server's incremented revision so the next save is guarded
      // against the row we just wrote.
      setState((current) => ({ ...current, revision: row.revision }))
      setIsDirty(false)
      setStatus("saved")
    } catch (caught) {
      if (!mountedRef.current || seq !== saveSeqRef.current) return
      if (caught instanceof VoyantApiError && caught.status === 409) {
        setError(caught)
        setStatus("conflict")
        return
      }
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setStatus("error")
    }
  }, [clearTimer, setStatus])

  const scheduleSave = useCallback(() => {
    setIsDirty(true)
    clearTimer()
    timerRef.current = setTimeout(() => {
      void runSave()
    }, autosaveDelayMs)
  }, [autosaveDelayMs, clearTimer, runSave])

  const mutate = useCallback(
    (patch: Partial<DocumentState>) => {
      setState((current) => {
        const next = { ...current, ...patch }
        stateRef.current = next
        return next
      })
      scheduleSave()
    },
    [scheduleSave],
  )

  const updateDraft = useCallback(
    (updater: (draft: ReportDraft) => ReportDraft) => {
      mutate({ draft: updater(stateRef.current.draft) })
    },
    [mutate],
  )
  const setDraft = useCallback((draft: ReportDraft) => mutate({ draft }), [mutate])
  const setName = useCallback((name: string) => mutate({ name }), [mutate])
  const setDescription = useCallback(
    (description: string | null) => mutate({ description }),
    [mutate],
  )

  const flush = useCallback(async () => {
    await runSave()
  }, [runSave])

  const adopt = useCallback(
    (row: ReportDocumentSnapshot) => {
      clearTimer()
      // Invalidate any in-flight save so its late resolution can't dirty the
      // freshly adopted baseline.
      saveSeqRef.current++
      const next: DocumentState = {
        draft: row.draft,
        name: row.name,
        description: row.description,
        revision: row.revision,
      }
      stateRef.current = next
      setState(next)
      setIsDirty(false)
      setError(null)
      setStatus("idle")
    },
    [clearTimer, setStatus],
  )

  const resolveConflict = useCallback(
    async (strategy: "reload" | "overwrite") => {
      const latest = await adapterRef.current.reload()
      if (!mountedRef.current) return
      if (strategy === "reload") {
        adopt({
          draft: latest.draft,
          name: latest.name,
          description: latest.description,
          revision: latest.revision,
        })
        setStatus("saved")
        return
      }
      // overwrite: keep local content, but base the next save on the latest
      // revision so the guard passes. Update the ref synchronously so the
      // immediately following save reads the rebased revision.
      const rebased = { ...stateRef.current, revision: latest.revision }
      stateRef.current = rebased
      setState(rebased)
      await runSave()
    },
    [adopt, runSave, setStatus],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  return {
    draft: state.draft,
    name: state.name,
    description: state.description,
    revision: state.revision,
    status,
    error,
    isDirty,
    updateDraft,
    setDraft,
    setName,
    setDescription,
    flush,
    adopt,
    resolveConflict,
  }
}
