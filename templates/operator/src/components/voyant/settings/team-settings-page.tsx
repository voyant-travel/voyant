import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voyantjs/ui/components"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { formatMessage, useLocale } from "@voyantjs/voyant-admin"
import { Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

type Invitation = {
  id: string
  email: string
  expiresAt: string
  redeemedAt: string | null
  createdBy: string
  createdAt: string
}

type CreateInviteResponse = {
  data: {
    id: string
    email: string
    expiresAt: string
    acceptUrl: string
    emailSent: boolean
  }
}

const QK = ["admin-invitations"] as const

export function TeamSettingsPage() {
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const queryClient = useQueryClient()

  const invitesQuery = useQuery({
    queryKey: QK,
    queryFn: () => api.get<{ data: Invitation[] }>("/v1/admin/invitations"),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/admin/invitations/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QK }),
  })

  const invites = invitesQuery.data?.data ?? []
  const pending = invites.filter((i) => !i.redeemedAt && new Date(i.expiresAt) > new Date())
  const spent = invites.filter((i) => i.redeemedAt || new Date(i.expiresAt) <= new Date())

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.team.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.team.description}</p>
        </div>
        <InviteMemberDialog />
      </div>

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
            <ul className="flex flex-col divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                  key={i}
                  className="flex items-center gap-4 py-3"
                >
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </li>
              ))}
            </ul>
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
                        confirm(
                          formatMessage(messages.team.revokeConfirm, {
                            email: invite.email,
                          }),
                        )
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

      {spent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.team.history}</CardTitle>
            <CardDescription>{messages.team.historyDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {spent.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center gap-4 py-2.5 text-muted-foreground"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{invite.email}</span>
                  <span className="text-xs">
                    {invite.redeemedAt
                      ? formatMessage(messages.team.redeemed, {
                          date: new Date(invite.redeemedAt).toLocaleDateString(resolvedLocale),
                        })
                      : formatMessage(messages.team.expired, {
                          date: new Date(invite.expiresAt).toLocaleDateString(resolvedLocale),
                        })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function InviteMemberDialog() {
  const messages = useAdminMessages()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [result, setResult] = useState<CreateInviteResponse["data"] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useMutation({
    mutationFn: () =>
      api.post<CreateInviteResponse>("/v1/admin/invitations", { email: email.trim() }),
    onSuccess: (response) => {
      setResult(response.data)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: QK })
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : messages.team.errorCouldNotSendInvitation),
  })

  const close = () => {
    setOpen(false)
    // Let the dialog close animation finish before resetting state
    window.setTimeout(() => {
      setEmail("")
      setResult(null)
      setError(null)
      setCopied(false)
    }, 200)
  }

  const copyLink = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.acceptUrl)
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
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  {formatMessage(messages.team.inviteCreated, {
                    email: result.email,
                  })}{" "}
                  {result.emailSent
                    ? messages.team.inviteEmailSentSuffix
                    : messages.team.inviteManualShareSuffix}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{messages.team.acceptLink}</Label>
                <div className="flex gap-2">
                  <Input value={result.acceptUrl} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {copied ? messages.team.copied : messages.team.copy}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={close}>{messages.team.done}</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                create.mutate()
              }}
            >
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="invite-email">{messages.team.emailLabel}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={messages.team.emailPlaceholder}
                  required
                  autoComplete="off"
                  autoFocus
                />
              </div>
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
