"use client"

import type * as React from "react"

export interface AdminNavLinkProps {
  children: React.ReactNode
  href: string
  onClick?: () => void
  target?: "_self" | "_blank"
}

export type AdminNavLinkComponent = React.ComponentType<AdminNavLinkProps>

export function DefaultAdminNavLink({ children, href, onClick, target }: AdminNavLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  )
}
