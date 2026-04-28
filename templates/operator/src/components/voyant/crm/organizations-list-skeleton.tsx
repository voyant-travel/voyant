import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

/**
 * Route-level placeholder for /organizations. Matches OrganizationsPage +
 * OrganizationList: title/description, search + "New organization" button,
 * 5-column table (Name / Industry / Relation / Website / Updated), pagination.
 */
export function OrganizationsListSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Relation</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonTableRows
            rows={8}
            columns={5}
            columnWidths={["w-40", "w-24", "w-16", "w-48", "w-20"]}
          />
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
