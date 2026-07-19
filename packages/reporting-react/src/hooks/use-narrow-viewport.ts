import { useEffect, useState } from "react"

/**
 * Returns `true` when the viewport is narrower than `breakpointPx`, so the grid
 * can switch to the deterministic single-column projection. SSR-safe.
 */
export function useNarrowViewport(breakpointPx = 640): boolean {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const media = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    setNarrow(media.matches)
    const listener = (event: MediaQueryListEvent) => setNarrow(event.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [breakpointPx])

  return narrow
}
