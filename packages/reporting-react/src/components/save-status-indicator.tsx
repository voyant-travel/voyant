import type { SaveStatus } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"

export interface SaveStatusIndicatorProps {
  readonly status: SaveStatus
  readonly labels: ReportBuilderLabels
  readonly onRetry?: () => void
}

const STATUS_LABEL: Record<SaveStatus, (labels: ReportBuilderLabels) => string> = {
  idle: (l) => l.saveIdle,
  saving: (l) => l.saveSaving,
  saved: (l) => l.saveSaved,
  error: (l) => l.saveError,
}

/**
 * Announces autosave progress. Uses a polite live region so status changes are
 * read by assistive tech without stealing focus.
 */
export function SaveStatusIndicator({ status, labels, onRetry }: SaveStatusIndicatorProps) {
  return (
    <div className={`vrb-save-status vrb-save-status--${status}`} role="status" aria-live="polite">
      <span className="vrb-save-status__label">{STATUS_LABEL[status](labels)}</span>
      {status === "error" && onRetry ? (
        <button type="button" className="vrb-save-status__retry" onClick={onRetry}>
          {labels.retrySave}
        </button>
      ) : null}
    </div>
  )
}
