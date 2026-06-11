"use client"

import type { MouseEvent, ReactNode } from "react"

/**
 * SPA-friendly destination link shared by the packaged notifications admin
 * hosts: real href for a11y / middle-click, host-router navigation on plain
 * left click (packaged-admin RFC §4.7 — hrefs come from `useAdminHref`,
 * clicks go through `useAdminNavigate`).
 */
export function DestinationLink({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string
  onNavigate: () => void
  className?: string
  children: ReactNode
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    onNavigate()
  }
  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
