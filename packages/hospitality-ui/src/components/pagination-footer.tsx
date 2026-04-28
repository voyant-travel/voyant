"use client"

import { Button } from "@voyantjs/voyant-ui/components/button"

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
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex + 1 < pageCount

  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {pageIndex * pageSize + 1}-{Math.min((pageIndex + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPreviousPage}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          Previous
        </Button>
        <span>
          Page {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNextPage}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
