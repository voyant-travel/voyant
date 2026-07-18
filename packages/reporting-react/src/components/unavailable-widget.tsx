import type { LayoutItem } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"

export interface UnavailableWidgetProps {
  readonly item: LayoutItem
  readonly labels: ReportBuilderLabels
  readonly onRemove?: () => void
}

/**
 * Placeholder shown in edit mode for a layout item whose widget is no longer
 * available. It is always removable so the author can clean up the layout, and
 * it is never rendered in view mode (see {@link renderableItems}).
 */
export function UnavailableWidget({ item, labels, onRemove }: UnavailableWidgetProps) {
  return (
    <section className="vrb-widget vrb-widget--unavailable" aria-label={labels.unavailableTitle}>
      <header className="vrb-widget__header">
        <span className="vrb-widget__title">{labels.unavailableTitle}</span>
        <div className="vrb-widget__actions">
          <button
            type="button"
            className="vrb-widget__action vrb-widget__action--remove"
            aria-label={labels.removeWidget(item.widgetId)}
            onClick={onRemove}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </header>
      <div className="vrb-widget__body">
        <p>{labels.unavailableBody(item.widgetId)}</p>
      </div>
    </section>
  )
}
