"use client"

import { OperatorAdminPageShell } from "@voyant-travel/admin"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  confirmDialog,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@voyant-travel/ui/components"
import { Loader2, Send, UserPlus } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import { useAuthUiI18nOrDefault, useAuthUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationSummary,
  useCurrentWorkspace,
  useOrganizationInvitationMutation,
  useOrganizationInvitations,
  useOrganizationMemberMutation,
  useOrganizationMembers,
} from "../index.js"
import {
  InvitationsSection,
  MembersSection,
  OrganizationMembersPageSkeleton,
  roleToString,
} from "../internal/organization-members-page-sections.js"
import {
  mergeOrganizationMembersPageMessages,
  type OrganizationMembersPageMessages,
  type OrganizationMembersPageRoleOption,
  type PartialOrganizationMembersPageMessages,
} from "./organization-members-page-shared.js"

export { OrganizationMembersPageSkeleton } from "../internal/organization-members-page-sections.js"
export {
  defaultOrganizationMembersPageMessages,
  mergeOrganizationMembersPageMessages,
  type OrganizationMembersPageMessages,
  type OrganizationMembersPageRoleOption,
  type PartialOrganizationMembersPageMessages,
} from "./organization-members-page-shared.js"

export interface OrganizationMembersPageProps {
  actions?: ReactNode
  availableRoles?: Array<string | OrganizationMembersPageRoleOption>
  breadcrumbs?: ReactNode
  className?: string
  contentClassName?: string
  defaultInviteRole?: string
  messages?: PartialOrganizationMembersPageMessages
  organizationId?: string
  showCancelInvitationAction?: boolean
  showInviteForm?: boolean
  showMemberRemovalAction?: boolean
  showResendInvitationAction?: boolean
  showRoleAssignmentAction?: boolean
  showSidebarTrigger?: boolean
}

interface ResolvedOrganization {
  id: string
  summary: OrganizationSummary | null
}

const defaultRoles = ["owner", "admin", "member"]

function normalizeRoleOptions(
  roles: Array<string | OrganizationMembersPageRoleOption>,
  messages: OrganizationMembersPageMessages,
): OrganizationMembersPageRoleOption[] {
  return roles.map((role) => {
    if (typeof role !== "string") return role

    return {
      value: role,
      label: messages.roles[role] ?? role,
    }
  })
}

function resolveMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function isPendingInvitation(invitation: OrganizationInvitation) {
  return invitation.status.toLowerCase() === "pending"
}

function useResolvedOrganization(organizationId: string | undefined): {
  organization: ResolvedOrganization | null
  isLoading: boolean
  isError: boolean
} {
  const workspaceQuery = useCurrentWorkspace({ enabled: organizationId === undefined })
  const workspace = organizationId === undefined ? (workspaceQuery.data ?? null) : null
  const activeOrganization = workspace?.activeOrganization ?? null
  const resolvedId = organizationId ?? activeOrganization?.id ?? undefined

  return {
    organization: resolvedId ? { id: resolvedId, summary: activeOrganization } : null,
    isLoading: organizationId === undefined && workspaceQuery.isLoading,
    isError: organizationId === undefined && workspaceQuery.isError,
  }
}

export function OrganizationMembersPage({
  actions,
  availableRoles = defaultRoles,
  breadcrumbs,
  className,
  contentClassName,
  defaultInviteRole,
  messages: messageOverrides,
  organizationId,
  showCancelInvitationAction = true,
  showInviteForm = true,
  showMemberRemovalAction = true,
  showResendInvitationAction = true,
  showRoleAssignmentAction = true,
  showSidebarTrigger,
}: OrganizationMembersPageProps) {
  const i18n = useAuthUiI18nOrDefault()
  const defaultMessages = useAuthUiMessagesOrDefault().organizationMembersPage
  const messages = mergeOrganizationMembersPageMessages(messageOverrides, defaultMessages)
  const roleOptions = useMemo(
    () => normalizeRoleOptions(availableRoles, messages),
    [availableRoles, messages],
  )
  const initialInviteRole =
    defaultInviteRole ?? roleOptions.at(-1)?.value ?? defaultRoles.at(-1) ?? "member"
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState(initialInviteRole)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setInviteRole(initialInviteRole)
  }, [initialInviteRole])

  const resolved = useResolvedOrganization(organizationId)
  const organization = resolved.organization
  const organizationFilters = organization ? { organizationId: organization.id } : undefined
  const membersQuery = useOrganizationMembers({
    enabled: Boolean(organization),
    filters: organizationFilters,
  })
  const invitationsQuery = useOrganizationInvitations({
    enabled: Boolean(organization),
    filters: organizationFilters,
  })
  const memberMutations = useOrganizationMemberMutation()
  const invitationMutations = useOrganizationInvitationMutation()

  const members = membersQuery.data?.members ?? []
  const invitations = (invitationsQuery.data ?? []).filter(isPendingInvitation)
  const isLoading = resolved.isLoading || membersQuery.isLoading || invitationsQuery.isLoading
  const isError = resolved.isError || membersQuery.isError || invitationsQuery.isError

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)

    if (!organization) {
      setActionError(messages.noActiveOrganization)
      return
    }

    const email = inviteEmail.trim()
    if (!email) {
      setActionError(messages.invite.errors.emailRequired)
      return
    }

    try {
      await invitationMutations.invite.mutateAsync({
        email,
        organizationId: organization.id,
        role: inviteRole,
      })
      setInviteEmail("")
      setInviteRole(initialInviteRole)
    } catch (error) {
      setActionError(resolveMutationError(error, messages.invite.errors.failed))
    }
  }

  const updateRole = async (member: OrganizationMember, role: string) => {
    if (!organization || role === roleToString(member.role)) return
    setActionError(null)

    try {
      await memberMutations.updateRole.mutateAsync({
        memberId: member.id,
        organizationId: organization.id,
        role,
      })
    } catch (error) {
      setActionError(resolveMutationError(error, messages.members.errors.updateRoleFailed))
    }
  }

  const removeMember = async (member: OrganizationMember) => {
    if (!organization) return
    const label = member.user.email ?? member.user.id

    if (
      typeof window !== "undefined" &&
      !(await confirmDialog({
        description: messages.members.actions.removeConfirm(label),
        destructive: true,
      }))
    ) {
      return
    }

    setActionError(null)
    try {
      await memberMutations.remove.mutateAsync({
        memberIdOrEmail: member.user.email ?? member.id,
        organizationId: organization.id,
      })
    } catch (error) {
      setActionError(resolveMutationError(error, messages.members.errors.removeFailed))
    }
  }

  const resendInvitation = async (invitation: OrganizationInvitation) => {
    if (!organization) return
    setActionError(null)

    try {
      await invitationMutations.invite.mutateAsync({
        email: invitation.email,
        organizationId: organization.id,
        resend: true,
        role: invitation.role,
      })
    } catch (error) {
      setActionError(resolveMutationError(error, messages.invitations.errors.resendFailed))
    }
  }

  const cancelInvitation = async (invitation: OrganizationInvitation) => {
    setActionError(null)

    try {
      await invitationMutations.cancel.mutateAsync({ invitationId: invitation.id })
    } catch (error) {
      setActionError(resolveMutationError(error, messages.invitations.errors.cancelFailed))
    }
  }

  return (
    <OperatorAdminPageShell
      actions={actions}
      breadcrumbs={breadcrumbs}
      contentClassName={contentClassName}
      showSidebarTrigger={showSidebarTrigger}
    >
      <div
        data-slot="organization-members-page"
        className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6", className)}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{messages.title}</h1>
            <p className="text-sm text-muted-foreground">{messages.description}</p>
          </div>
          {organization?.summary ? (
            <Badge variant="secondary" className="w-fit">
              {organization.summary.name}
            </Badge>
          ) : null}
        </div>

        {showInviteForm ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {messages.invite.title}
              </CardTitle>
              <CardDescription>{messages.invite.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleInvite}
                className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]"
              >
                <div className="space-y-2">
                  <Label htmlFor="organization-member-invite-email">
                    {messages.invite.emailLabel}
                  </Label>
                  <Input
                    id="organization-member-invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder={messages.invite.emailPlaceholder}
                    disabled={!organization || invitationMutations.invite.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-member-invite-role">
                    {messages.invite.roleLabel}
                  </Label>
                  <NativeSelect
                    id="organization-member-invite-role"
                    className="w-full"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                    disabled={!organization || invitationMutations.invite.isPending}
                  >
                    {roleOptions.map((role) => (
                      <NativeSelectOption key={role.value} value={role.value}>
                        {role.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={!organization || invitationMutations.invite.isPending}
                  >
                    {invitationMutations.invite.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    {invitationMutations.invite.isPending
                      ? messages.invite.submitting
                      : messages.invite.submit}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {actionError ? (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        {!organization && !isLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {messages.noActiveOrganization}
            </CardContent>
          </Card>
        ) : null}

        {isError ? (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {messages.loadFailed}
          </div>
        ) : null}

        {isLoading ? (
          <>
            <div className="sr-only" aria-live="polite">
              {messages.loading}
            </div>
            <OrganizationMembersPageSkeleton />
          </>
        ) : organization && !isError ? (
          <>
            <MembersSection
              formatDateTime={i18n.formatDateTime}
              members={members}
              messages={messages}
              onRemove={(member) => void removeMember(member)}
              onUpdateRole={(member, role) => void updateRole(member, role)}
              roleOptions={roleOptions}
              showMemberRemovalAction={showMemberRemovalAction}
              showRoleAssignmentAction={showRoleAssignmentAction}
              removing={memberMutations.remove.isPending}
              updatingRole={memberMutations.updateRole.isPending}
            />
            <InvitationsSection
              canceling={invitationMutations.cancel.isPending}
              formatDateTime={i18n.formatDateTime}
              invitations={invitations}
              messages={messages}
              onCancel={(invitation) => void cancelInvitation(invitation)}
              onResend={(invitation) => void resendInvitation(invitation)}
              resending={invitationMutations.invite.isPending}
              roleOptions={roleOptions}
              showCancelInvitationAction={showCancelInvitationAction}
              showResendInvitationAction={showResendInvitationAction}
            />
          </>
        ) : null}
      </div>
    </OperatorAdminPageShell>
  )
}
