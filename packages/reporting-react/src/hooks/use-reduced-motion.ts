import { useEffect, useState } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Tracks the user's reduced-motion preference. Returns `true` when animation
 * should be suppressed. SSR-safe: assumes no reduced-motion until mounted, then
 * subscribes to changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const media = window.matchMedia(QUERY)
    setReduced(media.matches)
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [])

  return reduced
}
