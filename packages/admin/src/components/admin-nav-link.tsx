"use client"

import type * as React from "react"

export interface AdminNavLinkProps
  extends Omit<React.ComponentPropsWithoutRef<"a">, "href" | "onClick" | "target"> {
  children: React.ReactNode
  href: string
  onClick?: () => void
  target?: "_self" | "_blank"
}

export type AdminNavLinkComponent = React.ComponentType<AdminNavLinkProps>

export function DefaultAdminNavLink({
  "aria-label": ariaLabel,
  children,
  href,
  onClick,
  target,
  ...props
}: AdminNavLinkProps) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  )
}
