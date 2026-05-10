import { formatMessage } from "@voyantjs/i18n"
import { useLegalContracts } from "@voyantjs/legal-react"
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { Plus, Search } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { useLegalUiI18nOrDefault, useLegalUiMessagesOrDefault } from "../i18n/index.js"
import { legalContractScopes, legalContractStatuses } from "../i18n/messages.js"

const PAGE_SIZE = 25
const SCOPE_ALL = "__all__"
const STATUS_ALL = "__all__"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  signed: "default",
  executed: "default",
  expired: "destructive",
  void: "destructive",
}

export interface ContractDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export interface ContractsPageProps {
  className?: string
  onOpenContract?: (contractId: string) => void
  renderContractDialog?: (props: ContractDialogRenderProps) => ReactNode
  renderPersonCell?: (personId: string | null) => ReactNode
}

export function ContractsPage({
  className,
  onOpenContract,
  renderContractDialog,
  renderPersonCell,
}: ContractsPageProps = {}) {
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.contractsPage
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<string>(SCOPE_ALL)
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)

  const { data, isPending, isFetching, isError, refetch } = useLegalContracts({
    search,
    scope: scope === SCOPE_ALL ? "all" : scope,
    status: status === STATUS_ALL ? "all" : status,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })

  const contracts = data?.data ?? []
  const total = data?.total ?? 0
  const page = pageIndex + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showSkeleton = isPending || (isFetching && contracts.length === 0)

  const resetPage = () => setPageIndex(0)

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.title}</h1>
          <p className="text-sm text-muted-foreground">{f.description}</p>
        </div>
        {renderContractDialog ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {f.create}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] max-w-sm flex-1">
          <Label htmlFor="contracts-search" className="sr-only">
            {f.searchPlaceholder}
          </Label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="contracts-search"
            placeholder={f.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              resetPage()
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={scope}
          onValueChange={(value) => {
            setScope(value ?? SCOPE_ALL)
            resetPage()
          }}
        >
          <SelectTrigger className="w-[12.5rem]">
            <SelectValue placeholder={f.filters.scope} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SCOPE_ALL}>{f.filters.allScopes}</SelectItem>
            {legalContractScopes.map((value) => (
              <SelectItem key={value} value={value}>
                {messages.common.contractScopeLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? STATUS_ALL)
            resetPage()
          }}
        >
          <SelectTrigger className="w-[12.5rem]">
            <SelectValue placeholder={f.filters.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>{f.filters.allStatuses}</SelectItem>
            {legalContractStatuses.map((value) => (
              <SelectItem key={value} value={value}>
                {messages.common.contractStatusLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{f.columns.number}</TableHead>
              <TableHead>{f.columns.title}</TableHead>
              <TableHead>{f.columns.scope}</TableHead>
              <TableHead>{f.columns.status}</TableHead>
              <TableHead>{f.columns.person}</TableHead>
              <TableHead>{f.columns.created}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <ContractRowSkeleton rows={6} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-destructive">
                  {f.loadFailed}
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {f.empty}
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow
                  key={contract.id}
                  onClick={() => onOpenContract?.(contract.id)}
                  className={cn(onOpenContract && "cursor-pointer")}
                >
                  <TableCell className="font-mono text-xs">
                    {contract.contractNumber ?? messages.common.noResultsDash}
                  </TableCell>
                  <TableCell className="font-medium">{contract.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {messages.common.contractScopeLabels[
                        contract.scope as keyof typeof messages.common.contractScopeLabels
                      ] ?? contract.scope}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[contract.status] ?? "secondary"}>
                      {messages.common.contractStatusLabels[contract.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {renderPersonCell ? (
                      renderPersonCell(contract.personId)
                    ) : (
                      <span className="font-mono text-xs">
                        {contract.personId ?? messages.common.noResultsDash}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{i18n.formatDate(contract.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        shown={contracts.length}
        total={total}
        page={page}
        pageCount={pageCount}
        onPrevious={() => setPageIndex((prev) => Math.max(0, prev - 1))}
        onNext={() => setPageIndex((prev) => prev + 1)}
        canGoBack={pageIndex > 0}
        canGoForward={(pageIndex + 1) * PAGE_SIZE < total}
      />

      {renderContractDialog?.({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        onSuccess: () => {
          setDialogOpen(false)
          setPageIndex(0)
          void refetch()
        },
      })}
    </div>
  )
}

function PaginationBar({
  shown,
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
}: {
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
}) {
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.contractsPage.pagination
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{formatMessage(f.showing, { count: shown, total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          {f.previous}
        </Button>
        <span>{formatMessage(f.page, { page, pageCount })}</span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          {f.next}
        </Button>
      </div>
    </div>
  )
}

function ContractRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`contract-skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
