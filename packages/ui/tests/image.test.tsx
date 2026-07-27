import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Image } from "../src/components/image.js"

afterEach(() => {
  cleanup()
})

describe("Image", () => {
  it("renders the image while the source loads successfully", () => {
    render(<Image src="https://cdn.example.com/cover.png" alt="Coastal Day Cruise" />)

    const image = screen.getByAltText("Coastal Day Cruise")
    expect(image.tagName).toBe("IMG")
    expect(image.getAttribute("src")).toBe("https://cdn.example.com/cover.png")
  })

  it("swaps a failed source for the placeholder instead of a broken image", () => {
    render(<Image src="https://cdn.example.com/missing.png" alt="Coastal Day Cruise" />)

    fireEvent.error(screen.getByAltText("Coastal Day Cruise"))

    const fallback = screen.getByRole("img", { name: "Coastal Day Cruise" })
    expect(fallback.tagName).not.toBe("IMG")
    expect(fallback.getAttribute("data-slot")).toBe("image-fallback")
    expect(document.querySelector("img")).toBeNull()
  })

  it("renders the placeholder when no source is provided", () => {
    render(<Image alt="Coastal Day Cruise" />)

    const fallback = screen.getByRole("img", { name: "Coastal Day Cruise" })
    expect(fallback.getAttribute("data-slot")).toBe("image-fallback")
  })

  it("re-arms when the caller swaps in a different source", () => {
    const { rerender } = render(<Image src="https://cdn.example.com/missing.png" alt="Cover" />)

    fireEvent.error(screen.getByAltText("Cover"))
    expect(screen.getByRole("img", { name: "Cover" }).getAttribute("data-slot")).toBe(
      "image-fallback",
    )

    rerender(<Image src="https://cdn.example.com/replacement.png" alt="Cover" />)

    const image = screen.getByAltText("Cover")
    expect(image.tagName).toBe("IMG")
    expect(image.getAttribute("src")).toBe("https://cdn.example.com/replacement.png")
  })

  it("keeps layout classes on the placeholder and forwards onError", () => {
    const onError = vi.fn()
    render(
      <Image
        src="https://cdn.example.com/missing.png"
        alt="Cover"
        className="h-full w-full object-cover"
        onError={onError}
      />,
    )

    fireEvent.error(screen.getByAltText("Cover"))

    expect(onError).toHaveBeenCalledTimes(1)
    const fallback = screen.getByRole("img", { name: "Cover" })
    for (const token of ["h-full", "w-full", "object-cover"]) {
      expect(fallback.classList.contains(token)).toBe(true)
    }
  })
})
