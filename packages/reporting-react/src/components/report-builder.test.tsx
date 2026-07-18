// @vitest-environment jsdom

import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReportLayout, ReportPersistenceAdapter, WidgetDefinition } from "../types.js"
import { ReportBuilder } from "./report-builder.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// Minimal MediaQueryList stub. `matches: true` forces the deterministic narrow
// projection (no react-grid-layout in jsdom) and reduced motion (no Motion
// animation) for every query the builder subscribes to.
function stubMediaQuery(query: string): MediaQueryList {
  const noop = () => {}
  const list: MediaQueryList = {
    matches: true,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  }
  return list
}

function installMatchMedia() {
  vi.stubGlobal("matchMedia", stubMediaQuery)
}

// react-resizable-panels needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const widgets: WidgetDefinition[] = [
  {
    id: "revenue",
    title: "Revenue",
    defaultSize: { width: 4, height: 2 },
    render: () => <p>Revenue body</p>,
  },
  {
    id: "bookings",
    title: "Bookings",
    defaultSize: { width: 4, height: 2 },
    render: () => <p>Bookings body</p>,
  },
]

const layout: ReportLayout = {
  items: [
    { widgetId: "revenue", x: 0, y: 0, width: 6, height: 2 },
    { widgetId: "retired", x: 6, y: 0, width: 6, height: 2 },
  ],
}

const adapter: ReportPersistenceAdapter = { save: async () => {} }

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

describe("ReportBuilder", () => {
  beforeEach(() => {
    installMatchMedia()
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("view mode renders only available widgets and no catalog/handles", () => {
    const { container, unmount } = render(
      <ReportBuilder layout={layout} widgets={widgets} mode="view" adapter={adapter} />,
    )
    expect(container.querySelector('[data-mode="view"]')).not.toBeNull()
    expect(container.textContent).toContain("Revenue body")
    // The "retired" item has no available definition -> omitted in view mode.
    expect(container.querySelector(".vrb-widget--unavailable")).toBeNull()
    // No authoring surfaces in view mode.
    expect(container.querySelector(".vrb-catalog")).toBeNull()
    expect(container.querySelector(".vrb-widget__action--remove")).toBeNull()
    unmount()
  })

  it("edit mode shows the catalog, inspector, and unavailable placeholder", () => {
    const { container, unmount } = render(
      <ReportBuilder layout={layout} widgets={widgets} mode="edit" adapter={adapter} />,
    )
    expect(container.querySelector('[data-mode="edit"]')).not.toBeNull()
    expect(container.querySelector(".vrb-catalog")).not.toBeNull()
    expect(container.querySelector(".vrb-inspector")).not.toBeNull()
    // Retired widget appears as a removable placeholder in edit mode.
    expect(container.querySelector(".vrb-widget--unavailable")).not.toBeNull()
    unmount()
  })

  it("adds a widget from the catalog and removes it from the candidate list", () => {
    const { container, unmount } = render(
      <ReportBuilder layout={{ items: [] }} widgets={widgets} mode="edit" adapter={adapter} />,
    )
    const addButtons = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>(".vrb-catalog__add"))
    expect(addButtons()).toHaveLength(2)

    act(() => {
      addButtons()
        .find((b) => b.getAttribute("aria-label") === "Add Revenue")
        ?.click()
    })

    // Revenue is now placed on the canvas and gone from the catalog.
    expect(container.textContent).toContain("Revenue body")
    expect(addButtons().some((b) => b.getAttribute("aria-label") === "Add Revenue")).toBe(false)
    unmount()
  })
})
