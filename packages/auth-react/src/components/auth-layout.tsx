import { VoyantWordmark } from "@voyantjs/admin"
import { cn } from "@voyantjs/ui/components"
import type { ReactNode } from "react"

export interface AuthLayoutProps {
  className?: string
  children: ReactNode
}

export function AuthLayout({ className, children }: AuthLayoutProps) {
  return (
    <div
      className={cn("flex min-h-screen items-center justify-center bg-background px-4", className)}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center text-foreground">
          <VoyantWordmark className="h-7 w-auto" />
        </div>
        {children}
      </div>
    </div>
  )
}
