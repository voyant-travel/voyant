import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CurrencyInput, parseCurrencyInput } from "../src/components/currency-input.js"

afterEach(() => {
  cleanup()
})

describe("parseCurrencyInput", () => {
  it("rejects appended decimal money values instead of folding them into cents", () => {
    expect(parseCurrencyInput("165.00170.00")).toBeNull()
    expect(parseCurrencyInput("165,00170,00")).toBeNull()
  })

  it("rejects fractional precision beyond the configured minor units", () => {
    expect(parseCurrencyInput("170.001")).toBeNull()
  })

  it("accepts decimal input and grouped major units", () => {
    expect(parseCurrencyInput("170.00")).toBe(17_000)
    expect(parseCurrencyInput("1,234.56")).toBe(123_456)
    expect(parseCurrencyInput("1.234,56")).toBe(123_456)
  })
})

describe("CurrencyInput", () => {
  it("selects the existing amount on focus so replacement typing overwrites by default", () => {
    const onChange = vi.fn()
    render(<CurrencyInput aria-label="Amount" currency="EUR" value={16_500} onChange={onChange} />)

    const input = screen.getByLabelText<HTMLInputElement>("Amount")
    fireEvent.focus(input)

    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
  })

  it("keeps malformed appended values local and reports null to callers", () => {
    const onChange = vi.fn()
    render(<CurrencyInput aria-label="Amount" currency="EUR" value={16_500} onChange={onChange} />)

    const input = screen.getByLabelText<HTMLInputElement>("Amount")
    fireEvent.change(input, { target: { value: "165.00170.00" } })

    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(input.value).toBe("165.00170.00")
  })
})
