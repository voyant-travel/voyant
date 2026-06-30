import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DatePicker } from "../src/components/date-picker.js"

afterEach(() => {
  cleanup()
})

describe("DatePicker", () => {
  it("exposes visible calendar days as named buttons", () => {
    const onChange = vi.fn()

    render(
      <DatePicker
        value={null}
        onChange={onChange}
        placeholder="Pick a date"
        captionLayout="label"
        defaultMonth={new Date(2026, 6, 1)}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Pick a date" }))

    const dayButton = screen.getByRole("button", {
      name: /Wednesday, July 1(?:st)?, 2026/,
    })

    expect(dayButton).toBeInstanceOf(HTMLButtonElement)

    fireEvent.click(dayButton)

    expect(onChange).toHaveBeenCalledWith("2026-07-01")
  })
})
