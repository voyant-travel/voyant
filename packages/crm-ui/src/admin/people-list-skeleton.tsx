"use client"

import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { SkeletonRows } from "./crm-skeleton-rows.js"

/**
 * Route-level placeholder for the people list. Mirrors `PeoplePage` +
 * `PersonList`:
 *   - Title + description block
 *   - Search input (left) + "New person" button (right)
 *   - 4-column table: Name / Email / Phone / Relation
 *   - Pagination bar
 */
export function PeopleListSkeleton() {
  const columns = useCrmUiMessagesOrDefault().personList.columns

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{columns.name}</TableHead>
              <TableHead>{columns.email}</TableHead>
              <TableHead>{columns.phone}</TableHead>
              <TableHead>{columns.relation}</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonRows rows={8} widths={["w-40", "w-48", "w-32", "w-16"]} />
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )
}
