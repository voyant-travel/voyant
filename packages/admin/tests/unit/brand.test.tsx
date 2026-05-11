import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { VoyantMark, VoyantWordmark } from "../../src/index.js"

afterEach(() => {
  cleanup()
})

describe("Voyant brand components", () => {
  it("exports an accessible Voyant mark", () => {
    const { container } = render(<VoyantMark className="size-5 text-primary" />)

    expect(screen.getByRole("img", { name: "Voyant" })).not.toBeNull()
    expect(container.querySelector("[data-slot='voyant-mark']")).not.toBeNull()
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor")
  })

  it("exports an accessible Voyant wordmark", () => {
    const { container } = render(<VoyantWordmark className="h-6 w-auto" />)

    expect(screen.getByRole("img", { name: "Voyant" })).not.toBeNull()
    expect(container.querySelector("[data-slot='voyant-wordmark']")).not.toBeNull()
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor")
  })
})
