import { Skeleton } from "@voyantjs/ui/components/skeleton"

/**
 * List placeholder shared by the simple settings CRUD pages (channels,
 * product types, pricing categories, product tags, price catalogs). Each
 * row in these pages has the same shape: name + small meta line + action
 * dropdown. Sub-line count and action width are tweakable.
 */
export function SettingsListSkeleton({
  rows = 5,
  metaLines = 1,
}: {
  rows?: number
  /** Number of ~muted-foreground lines under the primary name. */
  metaLines?: number
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
            key={i}
            className="flex items-center justify-between gap-4 px-6 py-3"
          >
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              {Array.from({ length: metaLines }).map((__, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                <Skeleton key={j} className="h-3 w-64" />
              ))}
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Full page skeleton — title + description + "Add" button in header, then
 * a SettingsListSkeleton. Used as route pendingComponent.
 */
export function SettingsPageSkeleton({
  titleWidth,
  descriptionWidth,
  buttonWidth = "w-32",
  rows,
  metaLines,
}: {
  titleWidth: string
  descriptionWidth: string
  buttonWidth?: string
  rows?: number
  metaLines?: number
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className={`h-5 ${titleWidth}`} />
          <Skeleton className={`h-3.5 ${descriptionWidth}`} />
        </div>
        <Skeleton className={`h-8 ${buttonWidth}`} />
      </div>
      <SettingsListSkeleton rows={rows} metaLines={metaLines} />
    </div>
  )
}
