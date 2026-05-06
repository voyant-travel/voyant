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
import { Loader2, Plus, Search } from "lucide-react"
import * as React from "react"

import { useCrmUiI18nOrDefault } from "../i18n/index.js"
import type { CrmRelationType } from "../i18n/messages.js"
import { OrganizationDialog } from "./organization-dialog.js"

export interface OrganizationListProps {
  pageSize?: number
  onSelectOrganization?: (organization: OrganizationRecord) => void
}

function formatRelative(
  value: string,
  messages: ReturnType<typeof useCrmUiI18nOrDefault>["messages"],
): string {
  const timestamp = new Date(value)
  const diff = Date.now() - timestamp.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) return messages.common.today
  if (days < 7) return messages.common.relativeTime.daysAgo.replace("{count}", String(days))
  if (days < 30) {
    return messages.common.relativeTime.weeksAgo.replace("{count}", String(Math.floor(days / 7)))
  }
  if (days < 365) {
    return messages.common.relativeTime.monthsAgo.replace("{count}", String(Math.floor(days / 30)))
  }
  return messages.common.relativeTime.yearsAgo.replace("{count}", String(Math.floor(days / 365)))
}

export function OrganizationList({
  pageSize = 25,
  onSelectOrganization,
}: OrganizationListProps = {}) {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
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
            placeholder={messages.organizationList.searchPlaceholder}
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
          {messages.organizationList.create}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.organizationList.columns.name}</TableHead>
              <TableHead>{messages.organizationList.columns.industry}</TableHead>
              <TableHead>{messages.organizationList.columns.relation}</TableHead>
              <TableHead>{messages.organizationList.columns.website}</TableHead>
              <TableHead>{messages.organizationList.columns.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2
                    className="mx-auto size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {messages.organizationList.loadFailed}
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.organizationList.empty}
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((organization) => (
                <TableRow
                  key={organization.id}
                  onClick={() => handleEdit(organization)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{organization.name}</TableCell>
                  <TableCell>{organization.industry ?? messages.common.none}</TableCell>
                  <TableCell>
                    {organization.relation ? (
                      <Badge variant="secondary" className="capitalize">
                        {messages.common.relationTypeLabels[
                          organization.relation as CrmRelationType
                        ] ?? organization.relation}
                      </Badge>
                    ) : (
                      messages.common.none
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
                      messages.common.none
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(organization.updatedAt, messages)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {messages.common.pageSummary
            .replace("{shown}", String(organizations.length))
            .replace("{total}", String(total))}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {messages.common.previous}
          </Button>
          <span>
            {messages.common.page} {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {messages.common.next}
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
