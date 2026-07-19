"use client"

// Remote nav-icon adapter: app-declared nav icons are HTTPS asset URLs, but the
// shell's `NavItem.icon` contract is a `React.ComponentType<{ className }>` (a
// lucide component). This wraps a URL in a hardened `<img>` component that plugs
// into that contract unchanged, so installed-app nav entries render an icon
// without special-casing the sidebar.
import { cn } from "@voyant-travel/ui/components"
import { AppWindow } from "lucide-react"
import { useState } from "react"
import type { NavItem } from "../types.js"

type NavIcon = NonNullable<NavItem["icon"]>

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Build a {@link NavItem.icon} component for an app-declared icon URL.
 *
 * Absent or non-HTTPS URLs return the generic app-icon fallback directly. A
 * valid URL renders inside a hardened `<img>`: `referrerPolicy="no-referrer"`,
 * `loading="lazy"`, empty `alt` (decorative), non-draggable, sized by the
 * caller-passed `className` (the shell passes `h-4 w-4`) plus `object-contain`.
 * A broken image URL swaps to the same generic fallback via `onError`.
 *
 * NOTE: the host's Content-Security-Policy `img-src` must permit remote HTTPS
 * images for these to load. CSP wiring is downstream host configuration and is
 * intentionally NOT changed here.
 */
export function createRemoteNavIcon(url: string | undefined): NavIcon {
  if (!url || !isHttpsUrl(url)) {
    return AppWindow
  }
  return function RemoteNavIcon({ className }: { className?: string }) {
    const [failed, setFailed] = useState(false)
    if (failed) {
      return <AppWindow className={className} />
    }
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn("object-contain", className)}
        onError={() => setFailed(true)}
      />
    )
  }
}
