"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type {
  ActionApprovalDecisionResponse,
  ActionApprovalDetailResponse,
  ActionApprovalGetResponse,
  ActionApprovalListResponse,
} from "@voyantjs/action-ledger"
import { useLocale } from "@voyantjs/admin"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ExternalLink, ShieldCheck, XCircle } from "lucide-react"
import { toast } from "sonner"

import { useUser } from "@/components/providers/user-provider"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

type ApprovalDecisionStatus = "approved" | "denied"

export function ActionApprovalsPage() {
  const { resolvedLocale } = useLocale()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const canDecide = Boolean(user?.id)

  const approvalsQuery = useQuery({
    queryKey: queryKeys.actionLedger.approvals("pending"),
    queryFn: listPendingApprovals,
  })

  const decideApproval = useMutation({
    mutationFn: ({
      approval,
      status,
    }: {
      approval: ActionApprovalDetailResponse
      status: ApprovalDecisionStatus
    }) => {
      if (!user?.id) {
        throw new Error("Current user is required to decide an approval")
      }
      return decideActionApproval(approval, status, user.id)
    },
    onSuccess: async (_result, variables) => {
      toast.success(variables.status === "approved" ? "Approval accepted" : "Approval denied")
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionLedger.all,
      })
      const requestedAction = variables.approval.requestedAction
      if (requestedAction?.targetType === "booking") {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.bookings.actionLedger(requestedAction.targetId),
        })
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Approval decision failed")
    },
  })

  const approvals = approvalsQuery.data ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Action approvals</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Pending ledger-controlled actions that need a staff decision.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Pending approvals
            {approvals.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">
                {approvals.length}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approvalsQuery.isLoading ? (
            <p className="px-6 py-6 text-center text-muted-foreground text-sm">
              Loading approvals...
            </p>
          ) : approvals.length === 0 ? (
            <p className="px-6 py-6 text-center text-muted-foreground text-sm">
              No pending action approvals.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <ApprovalRow
                      key={approval.id}
                      approval={approval}
                      locale={resolvedLocale}
                      decisionDisabled={decideApproval.isPending || !canDecide}
                      onDecide={(status) => decideApproval.mutate({ approval, status })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ApprovalRow({
  approval,
  locale,
  decisionDisabled,
  onDecide,
}: {
  approval: ActionApprovalDetailResponse
  locale: string
  decisionDisabled: boolean
  onDecide: (status: ApprovalDecisionStatus) => void
}) {
  const requestedAction = approval.requestedAction
  const targetLabel = requestedAction
    ? `${formatTargetType(requestedAction.targetType)} ${requestedAction.targetId}`
    : approval.requestedActionId

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
        {formatDateTime(approval.createdAt, locale)}
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {requestedAction ? formatActionName(requestedAction.actionName) : "Requested action"}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
          {requestedAction?.targetType === "booking" ? (
            <Link
              to="/bookings/$id"
              params={{ id: requestedAction.targetId }}
              className="inline-flex items-center text-primary underline-offset-4 hover:underline"
            >
              {targetLabel}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          ) : (
            <span className="max-w-[18rem] truncate font-mono">{targetLabel}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{requestedAction?.principalType ?? "unknown"}</div>
        <div className="mt-0.5 max-w-[13rem] truncate font-mono text-muted-foreground text-xs">
          {requestedAction?.principalId ?? approval.requestedByPrincipalId}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={approval.riskSnapshot === "critical" ? "destructive" : "secondary"}>
          {approval.riskSnapshot}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="font-medium">{approval.policyName}</div>
        <div className="mt-0.5 text-muted-foreground text-xs">
          {approval.reasonCode ?? approval.policyVersion}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={decisionDisabled}
            onClick={() => onDecide("denied")}
          >
            <XCircle className="h-4 w-4" />
            Deny
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={decisionDisabled}
            onClick={() => onDecide("approved")}
          >
            <ShieldCheck className="h-4 w-4" />
            Approve
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

async function listPendingApprovals(): Promise<ActionApprovalDetailResponse[]> {
  const list = await api.get<ActionApprovalListResponse>(
    "/v1/admin/action-ledger/approvals?status=pending&limit=50",
  )

  const details = await Promise.all(
    list.data.map((approval) =>
      api.get<ActionApprovalGetResponse>(`/v1/admin/action-ledger/approvals/${approval.id}`),
    ),
  )

  return details.map((response) => response.data)
}

async function decideActionApproval(
  approval: ActionApprovalDetailResponse,
  status: ApprovalDecisionStatus,
  userId: string,
): Promise<ActionApprovalDecisionResponse> {
  return api.post<ActionApprovalDecisionResponse>(
    `/v1/admin/action-ledger/approvals/${approval.id}/decide`,
    {
      status,
      decidedByPrincipalId: userId,
      decisionAction: {
        actionName: status === "approved" ? "action_approval.approve" : "action_approval.deny",
        actionVersion: "v1",
        actorType: "staff",
        principalType: "user",
        principalId: userId,
        callerType: "session",
        routeOrToolName: "operator.action-ledger.approvals",
        idempotencyScope: `action_approval:${approval.id}:decision`,
        idempotencyKey: status,
        authorizationSource: "operator_ui",
      },
    },
  )
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatActionName(value: string) {
  return value.replaceAll(".", " / ").replaceAll("_", " ")
}

function formatTargetType(value: string) {
  return value.replaceAll("_", " ")
}
