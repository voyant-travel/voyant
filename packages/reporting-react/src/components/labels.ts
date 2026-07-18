/**
 * UI strings, injectable so the host app owns translation. The package ships
 * English defaults but never hard-codes copy inside components.
 */
export interface ReportBuilderLabels {
  readonly catalogTitle: string
  readonly catalogEmpty: string
  readonly addWidget: (title: string) => string
  readonly inspectorTitle: string
  readonly inspectorEmpty: string
  readonly configureWidget: (title: string) => string
  readonly removeWidget: (title: string) => string
  readonly dragHandle: (title: string) => string
  readonly moveResizeHint: string
  readonly unavailableTitle: string
  readonly unavailableBody: (widgetId: string) => string
  readonly saveIdle: string
  readonly saveSaving: string
  readonly saveSaved: string
  readonly saveError: string
  readonly retrySave: string
  readonly emptyCanvas: string
}

export const defaultLabels: ReportBuilderLabels = {
  catalogTitle: "Widgets",
  catalogEmpty: "All available widgets have been added.",
  addWidget: (title) => `Add ${title}`,
  inspectorTitle: "Configure",
  inspectorEmpty: "Select a widget to configure it.",
  configureWidget: (title) => `Configure ${title}`,
  removeWidget: (title) => `Remove ${title}`,
  dragHandle: (title) =>
    `${title}. Press arrow keys to move, hold Shift and press arrow keys to resize.`,
  moveResizeHint: "Use arrow keys to move this widget. Hold Shift with arrow keys to resize it.",
  unavailableTitle: "Widget unavailable",
  unavailableBody: (widgetId) =>
    `The widget "${widgetId}" is no longer available. Remove it or restore the widget.`,
  saveIdle: "All changes saved",
  saveSaving: "Saving…",
  saveSaved: "All changes saved",
  saveError: "Could not save changes",
  retrySave: "Retry",
  emptyCanvas: "No widgets yet. Add one from the catalog to start your report.",
}

export function resolveLabels(overrides?: Partial<ReportBuilderLabels>): ReportBuilderLabels {
  return overrides ? { ...defaultLabels, ...overrides } : defaultLabels
}
