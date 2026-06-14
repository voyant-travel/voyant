"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components"
import { Loader2, Mail, RefreshCw, Trash2, Users } from "lucide-react"
import type {
  OrganizationMembersPageMessages,
  OrganizationMembersPageRoleOption,
} from "../components/organization-members-page-shared.js"
import type {
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMembersResponse,
} from "../index.js"

const skeletonRows = ["member-row-1", "member-row-2", "member-row-3"]

export function roleToString(role: OrganizationMember["role"] | OrganizationInvitation["role"]) {
  return Array.isArray(role) ? (role[0] ?? "") : role
}

function formatRole(
  role: OrganizationMember["role"] | OrganizationInvitation["role"],
  roleOptions: OrganizationMembersPageRoleOption[],
): string {
  const labels = new Map(roleOptions.map((option) => [option.value, option.label]))
  const roles = Array.isArray(role) ? role : [role]
  return roles.map((value) => labels.get(value) ?? value).join(", ")
}

function formatOptionalDate(
  value: string | null | undefined,
  fallback: string,
  formatDateTime: (value: string) => string,
) {
  if (!value) return fallback
  return formatDateTime(value)
}

function getMemberDisplayName(member: OrganizationMember) {
  return member.user.name || member.user.email || member.user.id
}

export function OrganizationMembersPageSkeleton() {
  return (
    <div data-slot="organization-members-page-skeleton" className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_100px]">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {skeletonRows.map((row) => (
            <div key={row} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20 md:justify-self-end" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function MembersSection({
  formatDateTime,
  members,
  messages,
  onRemove,
  onUpdateRole,
  removing,
  roleOptions,
  showMemberRemovalAction,
  showRoleAssignmentAction,
  updatingRole,
}: {
  formatDateTime: (value: string) => string
  members: OrganizationMembersResponse["members"]
  messages: OrganizationMembersPageMessages
  onRemove: (member: OrganizationMember) => void
  onUpdateRole: (member: OrganizationMember, role: string) => void
  removing: boolean
  roleOptions: OrganizationMembersPageRoleOption[]
  showMemberRemovalAction: boolean
  showRoleAssignmentAction: boolean
  updatingRole: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden="true" />
          {messages.members.title}
        </CardTitle>
        <CardDescription>{messages.members.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.members.memberColumn}</TableHead>
              <TableHead>{messages.members.roleColumn}</TableHead>
              <TableHead>{messages.members.joinedColumn}</TableHead>
              <TableHead className="w-20 text-right">{messages.members.actionsColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                  {messages.members.empty}
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium">{getMemberDisplayName(member)}</div>
                      {member.user.email ? (
                        <div className="text-xs text-muted-foreground">{member.user.email}</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {showRoleAssignmentAction ? (
                      <NativeSelect
                        aria-label={messages.members.actions.updateRoleAriaLabel(
                          getMemberDisplayName(member),
                        )}
                        value={roleToString(member.role)}
                        onChange={(event) => onUpdateRole(member, event.target.value)}
                        disabled={updatingRole}
                      >
                        {roleOptions.map((role) => (
                          <NativeSelectOption key={role.value} value={role.value}>
                            {role.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Badge variant="outline">{formatRole(member.role, roleOptions)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatOptionalDate(member.createdAt, messages.date.unknown, formatDateTime)}
                  </TableCell>
                  <TableCell>
                    {showMemberRemovalAction ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          aria-label={messages.members.actions.removeAriaLabel(
                            getMemberDisplayName(member),
                          )}
                          title={messages.members.actions.remove}
                          disabled={removing}
                          onClick={() => onRemove(member)}
                        >
                          {removing ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function InvitationsSection({
  canceling,
  formatDateTime,
  invitations,
  messages,
  onCancel,
  onResend,
  resending,
  roleOptions,
  showCancelInvitationAction,
  showResendInvitationAction,
}: {
  canceling: boolean
  formatDateTime: (value: string) => string
  invitations: OrganizationInvitation[]
  messages: OrganizationMembersPageMessages
  onCancel: (invitation: OrganizationInvitation) => void
  onResend: (invitation: OrganizationInvitation) => void
  resending: boolean
  roleOptions: OrganizationMembersPageRoleOption[]
  showCancelInvitationAction: boolean
  showResendInvitationAction: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" aria-hidden="true" />
          {messages.invitations.title}
        </CardTitle>
        <CardDescription>{messages.invitations.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.invitations.emailColumn}</TableHead>
              <TableHead>{messages.invitations.roleColumn}</TableHead>
              <TableHead>{messages.invitations.expiresColumn}</TableHead>
              <TableHead className="w-36 text-right">
                {messages.invitations.actionsColumn}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                  {messages.invitations.empty}
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span>{invitation.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatRole(invitation.role, roleOptions)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatOptionalDate(
                      invitation.expiresAt,
                      messages.date.unknown,
                      formatDateTime,
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {showResendInvitationAction ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={messages.invitations.actions.resendAriaLabel(
                            invitation.email,
                          )}
                          title={messages.invitations.actions.resend}
                          disabled={resending}
                          onClick={() => onResend(invitation)}
                        >
                          {resending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      ) : null}
                      {showCancelInvitationAction ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          aria-label={messages.invitations.actions.cancelAriaLabel(
                            invitation.email,
                          )}
                          title={messages.invitations.actions.cancel}
                          disabled={canceling}
                          onClick={() => onCancel(invitation)}
                        >
                          {canceling ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
