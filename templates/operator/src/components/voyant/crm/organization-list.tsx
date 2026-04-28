"use client"

import { type OrganizationRecord, useOrganizations } from "@voyantjs/crm-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { formatMessage } from "@voyantjs/voyant-admin"
import { Plus, Search } from "lucide-react"
import * as React from "react"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

import { OrganizationDialog } from "./organization-dialog"

export interface OrganizationListProps {
  pageSize?: number
  onSelectOrganization?: (organization: OrganizationRecord) => void
}

function formatRelative(
  value: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationList"],
): string {
  const timestamp = new Date(value)
  const diff = Date.now() - timestamp.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) return messages.relativeToday
  if (days < 7) return formatMessage(messages.relativeDaysAgo, { count: days })
  if (days < 30) return formatMessage(messages.relativeWeeksAgo, { count: Math.floor(days / 7) })
  if (days < 365) {
    return formatMessage(messages.relativeMonthsAgo, { count: Math.floor(days / 30) })
  }
  return formatMessage(messages.relativeYearsAgo, { count: Math.floor(days / 365) })
}

export function OrganizationList({
  pageSize = 25,
  onSelectOrganization,
}: OrganizationListProps = {}) {
  const messages = useAdminMessages()
  const listMessages = messages.crm.organizationList
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OrganizationRecord | undefined>(undefined)

  const { data, isPending, isError } = useOrganizations({
    search: search || undefined,
    limit: pageSize,
    offset,
  })

  const organizations = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const handleEdit = (organization: OrganizationRecord) => {
    if (onSelectOrganization) {
      onSelectOrganization(organization)
      return
    }
    setEditing(organization)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  return (
    <div data-slot="organization-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={listMessages.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} data-slot="organization-list-create">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {listMessages.newAction}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{listMessages.columnName}</TableHead>
              <TableHead>{listMessages.columnIndustry}</TableHead>
              <TableHead>{listMessages.columnRelation}</TableHead>
              <TableHead>{listMessages.columnWebsite}</TableHead>
              <TableHead>{listMessages.columnUpdated}</TableHead>
            </TableRow>
          </TableHeader>
          {isPending ? (
            <SkeletonTableRows
              rows={8}
              columns={5}
              columnWidths={["w-40", "w-24", "w-16", "w-48", "w-20"]}
            />
          ) : isError ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {listMessages.loadFailed}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : organizations.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {listMessages.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {organizations.map((organization) => (
                <TableRow
                  key={organization.id}
                  onClick={() => handleEdit(organization)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{organization.name}</TableCell>
                  <TableCell>{organization.industry ?? "—"}</TableCell>
                  <TableCell>
                    {organization.relation ? (
                      <Badge variant="secondary" className="capitalize">
                        {organization.relation}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {organization.website ? (
                      <a
                        href={organization.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {organization.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(organization.updatedAt, listMessages)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {organizations.length} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {listMessages.previous}
          </Button>
          <span>{formatMessage(messages.settings.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {listMessages.next}
          </Button>
        </div>
      </div>

      <OrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        organization={editing}
        onSuccess={(organization) => {
          if (onSelectOrganization) {
            onSelectOrganization(organization)
          }
        }}
      />
    </div>
  )
}
