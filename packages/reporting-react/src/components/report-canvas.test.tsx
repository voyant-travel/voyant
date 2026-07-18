// @vitest-environment jsdom

import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DRAG_HANDLE_CLASS } from "../grid/voyant-grid.js"
import { buildRegistry } from "../report-model.js"
import type { LayoutItem, WidgetDefinition } from "../types.js"
import { defaultLabels } from "./labels.js"
import { ReportCanvas } from "./report-canvas.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const revenue: WidgetDefinition = {
  id: "revenue",
  title: "Revenue",
  defaultSize: { width: 4, height: 2 },
  render: () => <p data-testid="revenue-body">Revenue body</p>,
}

const registry = buildRegistry([revenue])

const place = (widgetId: string, over: Partial<LayoutItem> = {}): LayoutItem => ({
  widgetId,
  x: 0,
  y: 0,
  width: 4,
  height: 2,
  ...over,
})

function render(ui: ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  let root: Root
  act(() => {
    root = createRoot(container)
    root.render(ui)
  })
  return {
    container,
    unmount: () =>
      act(() => {
        root.unmount()
        container.remove()
      }),
  }
}

describe("ReportCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("view mode renders widget bodies with no authoring handles", () => {
    const { container, unmount } = render(
      <ReportCanvas
        items={[place("revenue")]}
        registry={registry}
        mode="view"
        labels={defaultLabels}
        narrow
        animate={false}
      />,
    )
    expect(container.querySelector('[data-testid="revenue-body"]')).not.toBeNull()
    expect(container.querySelector(`.${DRAG_HANDLE_CLASS}`)).toBeNull()
    expect(container.querySelector(".vrb-widget__action--remove")).toBeNull()
    unmount()
  })

  it("edit mode exposes a keyboard drag handle and remove control", () => {
    const onRemove = vi.fn()
    const { container, unmount } = render(
      <ReportCanvas
        items={[place("revenue")]}
        registry={registry}
        mode="edit"
        labels={defaultLabels}
        narrow
        animate={false}
        onRemove={onRemove}
      />,
    )
    expect(container.querySelector(`.${DRAG_HANDLE_CLASS}`)).not.toBeNull()
    const remove = container.querySelector<HTMLButtonElement>(".vrb-widget__action--remove")
    expect(remove).not.toBeNull()
    act(() => remove?.click())
    expect(onRemove).toHaveBeenCalledWith("revenue")
    unmount()
  })

  it("edit mode renders unavailable widgets as removable placeholders", () => {
    const onRemove = vi.fn()
    const { container, unmount } = render(
      <ReportCanvas
        items={[place("revenue"), place("gone")]}
        registry={registry}
        mode="edit"
        labels={defaultLabels}
        narrow
        animate={false}
        onRemove={onRemove}
      />,
    )
    const placeholder = container.querySelector(".vrb-widget--unavailable")
    expect(placeholder).not.toBeNull()
    expect(placeholder?.textContent).toContain("gone")
    unmount()
  })

  it("keyboard arrow keys drive the move fallback in edit mode", () => {
    const onMove = vi.fn()
    const { container, unmount } = render(
      <ReportCanvas
        items={[place("revenue")]}
        registry={registry}
        mode="edit"
        labels={defaultLabels}
        narrow
        animate={false}
        onMove={onMove}
      />,
    )
    const handle = container.querySelector<HTMLButtonElement>(`.${DRAG_HANDLE_CLASS}`)
    act(() => {
      handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
    act(() => {
      handle?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          shiftKey: true,
          bubbles: true,
        }),
      )
    })
    expect(onMove).toHaveBeenCalledWith("revenue", { dx: 1, dy: 0 })
    unmount()
  })
})
