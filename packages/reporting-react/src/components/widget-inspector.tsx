import type { LayoutItem, WidgetDefinition } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"

export interface WidgetInspectorProps {
  readonly definition: WidgetDefinition | null
  readonly item: LayoutItem | null
  readonly labels: ReportBuilderLabels
  readonly onChange: (item: LayoutItem) => void
}

/**
 * Edit-mode inspector for configuring the selected widget. Delegates the actual
 * configuration UI to the widget definition's `renderConfig`, so the package
 * stays agnostic about widget internals.
 */
export function WidgetInspector({ definition, item, labels, onChange }: WidgetInspectorProps) {
  const hasConfig = definition && item && definition.renderConfig
  return (
    <aside className="vrb-inspector" aria-label={labels.inspectorTitle}>
      <h2 className="vrb-inspector__title">{labels.inspectorTitle}</h2>
      {hasConfig ? (
        <div className="vrb-inspector__body">{definition.renderConfig?.({ item, onChange })}</div>
      ) : (
        <p className="vrb-inspector__empty">{labels.inspectorEmpty}</p>
      )}
    </aside>
  )
}
