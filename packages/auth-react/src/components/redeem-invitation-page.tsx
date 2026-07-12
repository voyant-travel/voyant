"use client"

import { formatMessage } from "@voyant-travel/admin/lib/i18n"
import type { AdminAuthMessages } from "@voyant-travel/i18n"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { type FormEvent, useState } from "react"

export type RedeemInvitationStatus =
  | { valid: true; email: string; expiresAt: string }
  | { valid: false; reason?: "not_found" | "redeemed" | "expired" }

export interface RedeemInvitationPageProps {
  invitation: RedeemInvitationStatus | undefined
  isLoading: boolean
  isSubmitting: boolean
  messages: AdminAuthMessages["acceptInvite"]
  onRedeem: (input: { name: string; password: string }) => Promise<void>
}

export function RedeemInvitationPage({
  invitation,
  isLoading,
  isSubmitting,
  messages,
  onRedeem,
}: RedeemInvitationPageProps) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!invitation?.valid) {
    const reason = invitation && "reason" in invitation ? invitation.reason : null
    const message =
      reason === "redeemed"
        ? messages.invitationAlreadyUsed
        : reason === "expired"
          ? messages.invitationExpired
          : messages.invitationInvalid
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.invitationUnavailableTitle}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      await onRedeem({ name, password })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.couldNotAcceptInvitation)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>
          {formatMessage(messages.description, { email: invitation.email })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invitation-name">{messages.fullNameLabel}</Label>
            <Input
              id="invitation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitation-password">{messages.passwordLabel}</Label>
            <Input
              id="invitation-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {messages.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
