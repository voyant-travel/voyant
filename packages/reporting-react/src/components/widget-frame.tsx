import { AnimatePresence, motion } from "motion/react"
import type { KeyboardEvent } from "react"
import { DRAG_HANDLE_CLASS } from "../grid/voyant-grid.js"
import type { LayoutItem, ReportMode, WidgetDefinition } from "../types.js"
import type { ReportBuilderLabels } from "./labels.js"

export interface WidgetFrameProps {
  readonly definition: WidgetDefinition
  readonly item: LayoutItem
  readonly mode: ReportMode
  readonly labels: ReportBuilderLabels
  readonly selected?: boolean
  readonly animate?: boolean
  /** Keyboard/programmatic move by whole cells (edit mode only). */
  readonly onMove?: (delta: { dx: number; dy: number }) => void
  /** Keyboard/programmatic resize by whole cells (edit mode only). */
  readonly onResize?: (delta: { dWidth: number; dHeight: number }) => void
  readonly onConfigure?: () => void
  readonly onRemove?: () => void
}

const MOVE_KEYS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

const RESIZE_KEYS: Record<string, { dWidth: number; dHeight: number }> = {
  ArrowLeft: { dWidth: -1, dHeight: 0 },
  ArrowRight: { dWidth: 1, dHeight: 0 },
  ArrowUp: { dWidth: 0, dHeight: -1 },
  ArrowDown: { dWidth: 0, dHeight: 1 },
}

/**
 * A single placed widget. In edit mode it exposes a keyboard-accessible drag
 * handle (arrow keys move, Shift+arrow resizes — the accessible fallback for
 * pointer dragging/resizing) plus configure and remove controls. In view mode
 * it renders only the widget body with no authoring affordances.
 */
export function WidgetFrame({
  definition,
  item,
  mode,
  labels,
  selected = false,
  animate = true,
  onMove,
  onResize,
  onConfigure,
  onRemove,
}: WidgetFrameProps) {
  const editable = mode === "edit"

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editable) return
    if (event.shiftKey) {
      const delta = RESIZE_KEYS[event.key]
      if (delta) {
        event.preventDefault()
        onResize?.(delta)
      }
      return
    }
    const delta = MOVE_KEYS[event.key]
    if (delta) {
      event.preventDefault()
      onMove?.(delta)
    }
  }

  const body = (
    <section
      className={`vrb-widget${selected ? " vrb-widget--selected" : ""}`}
      aria-label={definition.title}
    >
      <header className="vrb-widget__header">
        {editable ? (
          <button
            type="button"
            className={`${DRAG_HANDLE_CLASS} vrb-widget__title`}
            aria-label={labels.dragHandle(definition.title)}
            aria-describedby={`${item.widgetId}-move-hint`}
            onKeyDown={handleKeyDown}
          >
            {definition.title}
          </button>
        ) : (
          <span className="vrb-widget__title">{definition.title}</span>
        )}
        {editable ? (
          <div className="vrb-widget__actions">
            {definition.renderConfig ? (
              <button
                type="button"
                className="vrb-widget__action"
                aria-label={labels.configureWidget(definition.title)}
                aria-pressed={selected}
                onClick={onConfigure}
              >
                <span aria-hidden="true">⚙</span>
              </button>
            ) : null}
            <button
              type="button"
              className="vrb-widget__action vrb-widget__action--remove"
              aria-label={labels.removeWidget(definition.title)}
              onClick={onRemove}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ) : null}
      </header>
      {editable ? (
        <p id={`${item.widgetId}-move-hint`} className="vrb-visually-hidden">
          {labels.moveResizeHint}
        </p>
      ) : null}
      <div className="vrb-widget__body">{definition.render({ mode, item })}</div>
    </section>
  )

  if (!animate) return body

  return (
    <AnimatePresence>
      <motion.div
        className="vrb-widget__motion"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
      >
        {body}
      </motion.div>
    </AnimatePresence>
  )
}
