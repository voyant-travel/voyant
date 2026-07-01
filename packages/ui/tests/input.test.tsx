import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Input } from "../src/components/input.js"

afterEach(() => {
  cleanup()
})

describe("Input", () => {
  it("renders unbounded number inputs without spinbutton max metadata", () => {
    render(<Input aria-label="Quantity" defaultValue="1" min={1} type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Quantity")

    expect(input).toMatchObject({
      type: "text",
      inputMode: "decimal",
      value: "1",
    })
    expect(input.hasAttribute("min")).toBe(false)
    expect(input.hasAttribute("max")).toBe(false)
    expect(input.hasAttribute("step")).toBe(false)
    expect(input.hasAttribute("aria-valuemax")).toBe(false)
  })

  it("treats an impossible max below min as unbounded metadata", () => {
    render(<Input aria-label="Quantity" defaultValue="1" max={0} min={1} type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Quantity")

    expect(input).toMatchObject({
      type: "text",
      inputMode: "decimal",
      value: "1",
    })
    expect(input.hasAttribute("min")).toBe(false)
    expect(input.hasAttribute("max")).toBe(false)
    expect(input.hasAttribute("aria-valuemax")).toBe(false)
  })

  it("keeps min validation for unbounded number inputs", () => {
    render(<Input aria-label="Quantity" min={1} type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Quantity")

    input.value = "0"
    input.dispatchEvent(new InputEvent("input", { bubbles: true }))

    expect(input.checkValidity()).toBe(false)
    expect(input.validationMessage).toBe("Value must be greater than or equal to 1.")
  })

  it("keeps step validation for unbounded number inputs", () => {
    render(<Input aria-label="Sort order" min={0} step={1} type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Sort order")

    input.value = "1.5"
    input.dispatchEvent(new InputEvent("input", { bubbles: true }))

    expect(input.checkValidity()).toBe(false)
    expect(input.validationMessage).toBe("Value must match the step 1.")
  })

  it("keeps numeric validation for unbounded number inputs", () => {
    render(<Input aria-label="Amount" type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Amount")

    input.value = "abc"
    input.dispatchEvent(new InputEvent("input", { bubbles: true }))

    expect(input.checkValidity()).toBe(false)
    expect(input.validationMessage).toBe("Enter a number.")
  })

  it("preserves native number semantics when a maximum is provided", () => {
    render(<Input aria-label="Capacity" max={10} min={1} step={1} type="number" />)

    const input = screen.getByLabelText<HTMLInputElement>("Capacity")

    expect(input).toMatchObject({
      type: "number",
      min: "1",
      max: "10",
      step: "1",
    })
  })
})
