"use client"

import { cn } from "@voyant-travel/ui/lib/utils"
import { useState } from "react"

export interface AirlineLogoProps {
  /** 2- or 3-char IATA carrier code. */
  iataCode: string
  /** Optional override; defaults to Kayak's public logo CDN. */
  logoUrl?: string | null
  /** Display name for `alt` text + initials fallback. */
  name?: string
  /** Pixel size of the logo box. Default 28. */
  size?: number
  className?: string
}

/**
 * Inline carrier logo. Falls back to a colored initials chip when the
 * image fails to load (e.g. unknown carrier, blocked CDN). Initials are
 * the IATA code so they're never wrong even when the airline name isn't
 * known to the operator's reference data.
 */
export function AirlineLogo({ iataCode, logoUrl, name, size = 28, className }: AirlineLogoProps) {
  const [errored, setErrored] = useState(false)
  const url = logoUrl ?? `https://www.kayak.com/h/run/airline-logos/${iataCode}.png`

  if (errored || !iataCode) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-medium text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
        role="img"
        aria-label={name ?? iataCode}
      >
        {iataCode}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={name ?? iataCode}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn("shrink-0 rounded object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}
