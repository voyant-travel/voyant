import { formatMessage } from "@voyantjs/admin"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui"
import type { AdminMessages } from "@/lib/admin-i18n"

interface SortHeaderProps<TField extends string> {
  label: string
  field: TField
  sortBy: string
  sortDir: "asc" | "desc"
  onSort: (field: TField) => void
}

export function SortHeader<TField extends string>({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: SortHeaderProps<TField>) {
  const active = sortBy === field
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="-ml-2 inline-flex h-8 items-center gap-1 rounded-sm px-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{label}</span>
      <Icon
        className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`}
        aria-hidden
      />
    </button>
  )
}

interface PaginationBarProps {
  messages: AdminMessages
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
}

export function PaginationBar({
  messages,
  shown,
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
}: PaginationBarProps) {
  const f = messages.finance
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{formatMessage(f.paginationShowing, { count: shown, total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          {f.paginationPrevious}
        </Button>
        <span>{formatMessage(f.paginationPage, { page, pageCount })}</span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          {f.paginationNext}
        </Button>
      </div>
    </div>
  )
}
