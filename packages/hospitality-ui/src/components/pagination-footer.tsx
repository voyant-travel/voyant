"use client"

import { Button } from "@voyantjs/ui/components/button"

import { useHospitalityUiMessagesOrDefault } from "../i18n/index.js"

type PaginationFooterProps = {
  pageIndex: number
  pageSize: number
  total: number
  onPageIndexChange: (pageIndex: number) => void
}

export function PaginationFooter({
  pageIndex,
  pageSize,
  total,
  onPageIndexChange,
}: PaginationFooterProps) {
  const messages = useHospitalityUiMessagesOrDefault()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex + 1 < pageCount

  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {messages.common.showingRange
          .replace("{start}", String(pageIndex * pageSize + 1))
          .replace("{end}", String(Math.min((pageIndex + 1) * pageSize, total)))
          .replace("{total}", String(total))}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPreviousPage}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          {messages.common.previous}
        </Button>
        <span>
          {messages.common.page} {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNextPage}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          {messages.common.next}
        </Button>
      </div>
    </div>
  )
}
