"use client"

import {
  type OrganizationInvitation,
  type OrganizationMember,
  useCurrentWorkspace,
  useOrganizationInvitationMutation,
  useOrganizationInvitations,
  useOrganizationMemberMutation,
  useOrganizationMembers,
} from "@voyantjs/auth-react"
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useRegistryAuthI18nOrDefault, useRegistryAuthMessagesOrDefault } from "./i18n"

export interface OrganizationMemberManagementProps {
  organizationId?: string
  availableRoles?: string[]
  defaultInviteRole?: string
  allowInvite?: boolean
  allowRoleChange?: boolean
  allowRemove?: boolean
  allowCancelInvitation?: boolean
}

function getPrimaryRole(value: OrganizationMember["role"] | OrganizationInvitation["role"]) {
  return Array.isArray(value) ? (value[0] ?? "member") : value
}

export function OrganizationMemberManagement({
  organizationId,
  availableRoles = ["owner", "admin", "member"],
  defaultInviteRole = availableRoles[availableRoles.length - 1] ?? "member",
  allowInvite = true,
  allowRoleChange = true,
  allowRemove = true,
  allowCancelInvitation = true,
}: OrganizationMemberManagementProps = {}) {
  const { formatDate } = useRegistryAuthI18nOrDefault()
  const messages = useRegistryAuthMessagesOrDefault().organizationMemberManagement
  const roleLabels = useRegistryAuthMessagesOrDefault().common.roleLabels
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState(defaultInviteRole)
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const { data: workspace, isPending: workspacePending } = useCurrentWorkspace()
  const resolvedOrganizationId = organizationId ?? workspace?.activeOrganization?.id ?? undefined

  const membersQuery = useOrganizationMembers({
    enabled: Boolean(resolvedOrganizationId),
    filters: resolvedOrganizationId ? { organizationId: resolvedOrganizationId } : undefined,
  })
  const invitationsQuery = useOrganizationInvitations({
    enabled: Boolean(resolvedOrganizationId),
    filters: resolvedOrganizationId ? { organizationId: resolvedOrganizationId } : undefined,
  })
  const { updateRole, remove } = useOrganizationMemberMutation()
  const { invite, cancel } = useOrganizationInvitationMutation()

  React.useEffect(() => {
    setInviteRole(defaultInviteRole)
  }, [defaultInviteRole])

  const members = membersQuery.data?.members ?? []
  const invitations = invitationsQuery.data ?? []
  const isLoading = workspacePending || (resolvedOrganizationId && membersQuery.isPending)
  const formatRoleLabel = React.useCallback(
    (role: string) => {
      if (role === "owner" || role === "admin" || role === "member") {
        return roleLabels[role]
      }
      return role
    },
    [roleLabels],
  )
  const formatRoleValue = React.useCallback(
    (value: OrganizationMember["role"] | OrganizationInvitation["role"]) =>
      Array.isArray(value) ? value.map(formatRoleLabel).join(", ") : formatRoleLabel(value),
    [formatRoleLabel],
  )

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteError(null)

    if (!resolvedOrganizationId) {
      setInviteError(messages.errors.noOrganizationSelected)
      return
    }

    if (!inviteEmail.trim()) {
      setInviteError(messages.errors.emailRequired)
      return
    }

    try {
      await invite.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: resolvedOrganizationId,
      })
      setInviteEmail("")
      setInviteRole(defaultInviteRole)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : messages.errors.inviteFailed)
    }
  }

  return (
    <Card data-slot="organization-member-management">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            {messages.title}
          </CardTitle>
          <CardDescription>{messages.description}</CardDescription>
        </div>
        {workspace?.activeOrganization ? (
          <Badge variant="secondary">{workspace.activeOrganization.name}</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {allowInvite ? (
          <form onSubmit={handleInvite} className="grid gap-3 rounded-md border p-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="organization-member-management-email">{messages.inviteByEmail}</Label>
              <Input
                id="organization-member-management-email"
                type="email"
                placeholder={messages.emailPlaceholder}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={!resolvedOrganizationId || invite.isPending}
              />
            </div>
            <div>
              <Label htmlFor="organization-member-management-role">{messages.role}</Label>
              <Select
                items={availableRoles.map((role) => ({
                  label: formatRoleLabel(role),
                  value: role,
                }))}
                value={inviteRole}
                onValueChange={setInviteRole}
                disabled={!resolvedOrganizationId || invite.isPending}
              >
                <SelectTrigger className="w-full" id="organization-member-management-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full"
                disabled={!resolvedOrganizationId || invite.isPending}
              >
                {invite.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="mr-2 size-4" aria-hidden="true" />
                )}
                {messages.invite}
              </Button>
            </div>
            {inviteError ? (
              <p className="text-sm text-destructive sm:col-span-4">{inviteError}</p>
            ) : null}
          </form>
        ) : null}

        {!resolvedOrganizationId ? (
          <p className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
            {messages.emptyOrganization}
          </p>
        ) : isLoading ? (
          <div className="flex min-h-24 items-center justify-center rounded-md border">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.members.member}</TableHead>
                    <TableHead>{messages.members.role}</TableHead>
                    <TableHead>{messages.members.joined}</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-sm text-muted-foreground"
                      >
                        {messages.members.none}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.user.name || member.user.email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {member.user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {allowRoleChange ? (
                            <Select
                              value={getPrimaryRole(member.role)}
                              onValueChange={(role) =>
                                void updateRole.mutateAsync({
                                  memberId: member.id,
                                  organizationId: resolvedOrganizationId,
                                  role,
                                })
                              }
                              disabled={updateRole.isPending}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {formatRoleLabel(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{formatRoleValue(member.role)}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(member.createdAt)}
                        </TableCell>
                        <TableCell>
                          {allowRemove ? (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (confirm(messages.members.removeConfirm)) {
                                    void remove.mutateAsync({
                                      memberIdOrEmail: member.user.email,
                                      organizationId: resolvedOrganizationId,
                                    })
                                  }
                                }}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.invitations.title}</TableHead>
                    <TableHead>{messages.invitations.role}</TableHead>
                    <TableHead>{messages.invitations.expires}</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-sm text-muted-foreground"
                      >
                        {messages.invitations.none}
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                            <span>{invitation.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatRoleValue(invitation.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invitation.expiresAt)}
                        </TableCell>
                        <TableCell>
                          {allowCancelInvitation ? (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={cancel.isPending}
                                onClick={() =>
                                  void cancel.mutateAsync({ invitationId: invitation.id })
                                }
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
