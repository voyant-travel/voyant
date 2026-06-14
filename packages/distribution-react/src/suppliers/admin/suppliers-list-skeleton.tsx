"use client"

import { Skeleton } from "@voyant-travel/ui/components/skeleton"

import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"

const COLUMNS = [
  { id: "name", width: "w-40" },
  { id: "type", width: "w-20" },
  { id: "status", width: "w-16" },
  { id: "country", width: "w-20" },
  { id: "currency", width: "w-12" },
] as const

/**
 * Route-level placeholder for the suppliers list. Mirrors `SuppliersPage`:
 *   - Page title + description
 *   - Filter row: search input (left), Filters button, "New Supplier" (right)
 *   - 5-column table: Name / Type / Status / Country / Currency
 *   - Summary + pagination footer
 */
export function SuppliersListSkeleton() {
  const messages = useSuppliersUiMessagesOrDefault()
  const columns = messages.suppliersPage.columns
  const titles = [columns.name, columns.type, columns.status, columns.country, columns.currency]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-[14rem] flex-1" />
        <Skeleton className="h-9 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {titles.map((title) => (
                <th key={title} className="px-4 py-3 font-medium">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, rowIndex) => `row-${rowIndex}`).map((rowKey) => (
              <tr key={rowKey} className="border-t">
                {COLUMNS.map((column) => (
                  <td key={`${rowKey}-${column.id}`} className="px-4 py-3">
                    <Skeleton className={`h-4 ${column.width}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-44" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )
}
