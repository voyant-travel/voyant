import type { WidgetDefinition } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"

export interface WidgetCatalogProps {
  readonly candidates: readonly WidgetDefinition[]
  readonly labels: ReportBuilderLabels
  readonly onAdd: (widget: WidgetDefinition) => void
}

/**
 * Edit-mode catalog of widgets that can still be added (those not already
 * placed on the canvas). Only rendered in edit mode.
 */
export function WidgetCatalog({ candidates, labels, onAdd }: WidgetCatalogProps) {
  return (
    <aside className="vrb-catalog" aria-label={labels.catalogTitle}>
      <h2 className="vrb-catalog__title">{labels.catalogTitle}</h2>
      {candidates.length === 0 ? (
        <p className="vrb-catalog__empty">{labels.catalogEmpty}</p>
      ) : (
        <ul className="vrb-catalog__list">
          {candidates.map((widget) => (
            <li key={widget.id} className="vrb-catalog__item">
              <button
                type="button"
                className="vrb-catalog__add"
                aria-label={labels.addWidget(widget.title)}
                onClick={() => onAdd(widget)}
              >
                <span className="vrb-catalog__item-title">{widget.title}</span>
                {widget.description ? (
                  <span className="vrb-catalog__item-desc">{widget.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
