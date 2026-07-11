"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type AccessCatalog,
  accessCatalogPermissionGroups,
  createEffectiveAccessCatalog,
  hasApiKeyPermission,
  permissionStringsToPermissions,
} from "@voyant-travel/types/api-keys"
import { MEMBER_ROLE_PRESETS, scopesForRole } from "@voyant-travel/types/member-roles"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voyant-travel/ui/components"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import { ScrollArea } from "@voyant-travel/ui/components/scroll-area"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"

import { formatMessage } from "../lib/i18n.js"
import { useLocale } from "../providers/locale.js"
import { useOperatorAdminMessages } from "../providers/operator-admin-messages.js"
import { useTeamSettingsPageApi } from "./team-settings-api.js"

// ---------------------------------------------------------------------------
// Cloud mode: the roster lives on the Voyant Cloud platform and is proxied
// through /v1/admin/team/*. Members can be granted/revoked access to THIS
// deployment; owners/admins (full platform access) are managed centrally.
// ---------------------------------------------------------------------------

type CloudMember = {
  membershipId: string
  externalUserId: string
  email: string | null
  roleSlug: string | null
  roleName: string | null
  status: string
  hasFullPlatformAccess: boolean
  hasDeploymentAccess: boolean
  isExplicitGrant: boolean
  permissions: string[] | null
}

type CloudInvitation = {
  id: string
  email: string
  state: "pending" | "accepted" | "expired" | "revoked"
  expiresAt: string
  acceptInvitationUrl: string
  createdAt: string
}

type CloudRole = { slug: string; name: string; description: string | null }

const CLOUD_MEMBERS_QK = ["admin-team-members"] as const
const CLOUD_INVITES_QK = ["admin-team-invitations"] as const

export function memberPermissionGroups(accessCatalog?: AccessCatalog) {
  return accessCatalogPermissionGroups(createEffectiveAccessCatalog(accessCatalog))
}

export function CloudTeamView({ accessCatalog }: { accessCatalog?: AccessCatalog }) {
  const api = useTeamSettingsPageApi()
  const messages = useOperatorAdminMessages()
  const { resolvedLocale } = useLocale()
  const queryClient = useQueryClient()

  const membersQuery = useQuery({
    queryKey: CLOUD_MEMBERS_QK,
    queryFn: () => api.get<{ data: CloudMember[] }>("/v1/admin/team/members"),
  })
  const invitesQuery = useQuery({
    queryKey: CLOUD_INVITES_QK,
    queryFn: () => api.get<{ data: CloudInvitation[] }>("/v1/admin/team/invitations"),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/admin/team/invitations/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CLOUD_INVITES_QK }),
  })

  const members = membersQuery.data?.data ?? []
  const invites = invitesQuery.data?.data ?? []
  const pending = invites.filter((i) => i.state === "pending" || i.state === "expired")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.team.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.team.description}</p>
        </div>
        <CloudInviteMemberDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.team.members.title}</CardTitle>
          <CardDescription>{messages.team.members.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {membersQuery.isPending ? (
            <ul className="flex flex-col divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: admin.
                  key={i}
                  className="flex items-center gap-4 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-7 w-24" />
                </li>
              ))}
            </ul>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{messages.team.members.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {members.map((member) => (
                <li key={member.membershipId} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.email ?? member.externalUserId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.roleName ?? member.roleSlug ?? messages.team.members.role}
                    </p>
                  </div>
                  {member.hasFullPlatformAccess ? (
                    <span
                      className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      title={messages.team.members.fullAccessHint}
                    >
                      {messages.team.members.fullAccess}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {memberAccessSummary(member, messages)}
                      </span>
                      <MemberPermissionsDialog member={member} accessCatalog={accessCatalog} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.team.pendingInvitations}</CardTitle>
          <CardDescription>
            {pending.length === 0
              ? messages.team.noOutstandingInvitations
              : formatMessage(
                  pending.length === 1
                    ? messages.team.invitationWaitingSingular
                    : messages.team.invitationWaitingPlural,
                  { count: pending.length },
                )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitesQuery.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{messages.team.nothingHereYet}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {pending.map((invite) => (
                <li key={invite.id} className="flex items-center gap-4 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMessage(messages.team.expires, {
                        date: new Date(invite.expiresAt).toLocaleString(resolvedLocale),
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      if (
                        confirm(formatMessage(messages.team.revokeConfirm, { email: invite.email }))
                      ) {
                        revoke.mutate(invite.id)
                      }
                    }}
                    disabled={revoke.isPending}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {messages.team.revoke}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CloudInviteMemberDialog() {
  const api = useTeamSettingsPageApi()
  const messages = useOperatorAdminMessages()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [roleSlug, setRoleSlug] = useState("")
  const [result, setResult] = useState<CloudInvitation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const rolesQuery = useQuery({
    queryKey: ["admin-team-roles"],
    queryFn: () => api.get<{ data: CloudRole[] }>("/v1/admin/team/roles"),
    enabled: open,
  })
  const roles = rolesQuery.data?.data ?? []

  const create = useMutation({
    mutationFn: () =>
      api.post<{ data: CloudInvitation }>("/v1/admin/team/invitations", {
        email: email.trim(),
        roleSlug: roleSlug || undefined,
      }),
    onSuccess: (response) => {
      setResult(response.data)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: CLOUD_INVITES_QK })
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : messages.team.errorCouldNotSendInvitation),
  })

  const close = () => {
    setOpen(false)
    window.setTimeout(() => {
      setEmail("")
      setRoleSlug("")
      setResult(null)
      setError(null)
      setCopied(false)
    }, 200)
  }

  const copyLink = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.acceptInvitationUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1 h-4 w-4" />
        {messages.team.inviteMember}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.team.inviteDialogTitle}</DialogTitle>
            <DialogDescription>{messages.team.inviteDialogDescription}</DialogDescription>
          </DialogHeader>

          {result ? (
            <>
              <DialogBody className="space-y-4">
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p>{formatMessage(messages.team.inviteCreated, { email: result.email })}</p>
                </div>
                <div className="space-y-2">
                  <Label>{messages.team.acceptLink}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={result.acceptInvitationUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyLink()}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      {copied ? messages.team.copied : messages.team.copy}
                    </Button>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button onClick={close}>{messages.team.done}</Button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="flex flex-1 flex-col overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault()
                create.mutate()
              }}
            >
              <DialogBody className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cloud-invite-email">{messages.team.emailLabel}</Label>
                  <Input
                    id="cloud-invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={messages.team.emailPlaceholder}
                    required
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                {roles.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="cloud-invite-role">{messages.team.members.roleLabel}</Label>
                    <select
                      id="cloud-invite-role"
                      value={roleSlug}
                      onChange={(e) => setRoleSlug(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">{messages.team.members.role}</option>
                      {roles.map((role) => (
                        <option key={role.slug} value={role.slug}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  {messages.team.cancel}
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {messages.team.sendInvitation}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

type AdminMessages = ReturnType<typeof useOperatorAdminMessages>

/** Expand a (possibly wildcard) scope list to the concrete catalog permissions it grants. */
function expandToConcrete(scopes: string[], catalog: AccessCatalog): Set<string> {
  const permissions = permissionStringsToPermissions(scopes)
  return new Set(
    accessCatalogPermissionGroups(catalog).flatMap((group) =>
      group.permissions
        .filter((p) => hasApiKeyPermission(permissions, p.resource, p.action, catalog))
        .map((p) => `${p.resource}:${p.action}`),
    ),
  )
}

/** The member's effective scopes today: explicit set, else role default if they have access. */
function memberCurrentScopes(member: CloudMember, catalog: AccessCatalog): string[] {
  if (member.permissions && member.permissions.length > 0) return member.permissions
  if (member.hasDeploymentAccess) {
    const base = scopesForRole(member.roleSlug) ?? []
    const normalizedRole = (member.roleSlug ?? "").trim().toLowerCase()
    const presetId =
      normalizedRole === "member"
        ? "editor"
        : normalizedRole === "guest"
          ? "viewer"
          : normalizedRole
    const selected = catalog.presets.find(
      (preset) => preset.kind === "staff" && preset.id === presetId,
    )
    return [...new Set([...base, ...(selected?.grants ?? [])])].sort()
  }
  return []
}

function memberAccessSummary(member: CloudMember, messages: AdminMessages): string {
  if (!member.hasDeploymentAccess) return messages.team.members.noAccess
  if (member.permissions && member.permissions.length > 0) return messages.team.members.custom
  return member.roleName ?? member.roleSlug ?? messages.team.members.roleDefault
}

// Concrete-scope presets. "Admin" is intentionally NOT here: full access must
// persist the real `*` wildcard (so it covers PII + future resources), not an
// expansion of the visible catalog — handled as a dedicated control below.
/**
 * Granular permission editor for a deployment member (cloud mode). Operates on
 * concrete `resource:action` strings drawn from the shared API-key catalog;
 * presets seed the selection and any box is then toggleable. Saving an empty
 * selection revokes the member's access to this deployment.
 */
function MemberPermissionsDialog({
  member,
  accessCatalog,
}: {
  member: CloudMember
  accessCatalog?: AccessCatalog
}) {
  const api = useTeamSettingsPageApi()
  const messages = useOperatorAdminMessages()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Full access is a real `*`, not an expansion of the visible catalog — so it
  // keeps PII + any future resources. Tracked separately from the checklist.
  const [wildcard, setWildcard] = useState(false)
  const catalog = useMemo(() => createEffectiveAccessCatalog(accessCatalog), [accessCatalog])
  const permissionGroups = useMemo(() => memberPermissionGroups(accessCatalog), [accessCatalog])
  const scopePresets = useMemo(
    () =>
      (["editor", "viewer"] as const).map((key) => ({
        key,
        label: MEMBER_ROLE_PRESETS[key].label,
        scopes: [
          ...(scopesForRole(key) ?? []),
          ...(catalog.presets.find((preset) => preset.kind === "staff" && preset.id === key)
            ?.grants ?? []),
        ],
      })),
    [catalog],
  )

  const openDialog = () => {
    const scopes = memberCurrentScopes(member, catalog)
    setWildcard(scopes.includes("*"))
    setSelected(expandToConcrete(scopes, catalog))
    setOpen(true)
  }

  const save = useMutation({
    mutationFn: () =>
      api.put(`/v1/admin/team/members/${member.membershipId}/permissions`, {
        permissions: wildcard ? ["*"] : [...selected],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLOUD_MEMBERS_QK })
      setOpen(false)
    },
  })

  const applyPreset = (scopes: readonly string[]) => {
    setWildcard(false)
    setSelected(expandToConcrete([...scopes], catalog))
  }

  const applyFullAccess = () => {
    setWildcard(true)
    setSelected(expandToConcrete(["*"], catalog))
  }

  const toggle = (key: string, checked: boolean) => {
    setWildcard(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        {messages.team.members.managePermissions}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? openDialog() : setOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.team.members.permissionsTitle}</DialogTitle>
            <DialogDescription>{messages.team.members.permissionsDescription}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {messages.team.members.presetLabel}:
              </span>
              <Button
                type="button"
                variant={wildcard ? "default" : "secondary"}
                size="sm"
                onClick={applyFullAccess}
              >
                {MEMBER_ROLE_PRESETS.admin.label}
              </Button>
              {scopePresets.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset(preset.scopes)}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setWildcard(false)
                  setSelected(new Set())
                }}
              >
                {messages.team.members.noAccess}
              </Button>
            </div>

            <ScrollArea className="h-80 pr-4">
              <div className="flex flex-col gap-4">
                {permissionGroups.map((group) => (
                  <div key={group.resource} className="space-y-2">
                    <p className="text-sm font-medium">{group.label}</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {group.permissions.map((perm) => {
                        const key = `${perm.resource}:${perm.action}`
                        return (
                          <label
                            key={key}
                            htmlFor={`perm-${key}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              id={`perm-${key}`}
                              checked={selected.has(key)}
                              onCheckedChange={(c) => toggle(key, c === true)}
                            />
                            <span>{perm.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {messages.team.cancel}
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {save.isPending ? messages.team.members.saving : messages.team.members.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
