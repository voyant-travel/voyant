import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components"
import { Separator } from "@voyant-travel/ui/components/separator"
import { MoreHorizontal } from "lucide-react"
import type { ReactNode } from "react"

export function Section({
  title,
  actions,
  children,
  contentClassName,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="font-semibold leading-none tracking-tight">{title}</h2>
        {actions}
      </div>
      <Separator />
      <div className={contentClassName ?? "px-6 py-4"}>{children}</div>
    </div>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm [&:not(:last-child)]:border-b">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function ActionMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className="h-8 w-8 text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
}

export function formatFileSize(value: number | null): string {
  if (value == null) return "-"
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
