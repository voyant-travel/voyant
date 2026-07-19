import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { createRemoteNavIcon } from "../../src/navigation/remote-nav-icon.js"

afterEach(() => {
  cleanup()
})

describe("createRemoteNavIcon", () => {
  it("renders a hardened <img> for a valid HTTPS url", () => {
    const Icon = createRemoteNavIcon("https://app.example.com/icon.svg")
    const { container } = render(createElement(Icon, { className: "h-4 w-4" }))

    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    expect(img?.getAttribute("src")).toBe("https://app.example.com/icon.svg")
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer")
    expect(img?.getAttribute("loading")).toBe("lazy")
    expect(img?.getAttribute("alt")).toBe("")
    expect(img?.getAttribute("draggable")).toBe("false")
    expect(img?.className).toContain("object-contain")
    expect(img?.className).toContain("h-4")
  })

  it("swaps to the generic fallback icon when the image fails to load", () => {
    const Icon = createRemoteNavIcon("https://app.example.com/broken.svg")
    const { container } = render(createElement(Icon, { className: "h-4 w-4" }))

    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    fireEvent.error(img as HTMLImageElement)

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("returns the generic fallback directly for an absent url", () => {
    const Icon = createRemoteNavIcon(undefined)
    const { container } = render(createElement(Icon, { className: "h-4 w-4" }))

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("returns the generic fallback for a non-HTTPS url", () => {
    const Icon = createRemoteNavIcon("http://app.example.com/icon.svg")
    const { container } = render(createElement(Icon, { className: "h-4 w-4" }))

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
