"use client"

import { OperatorAdminPageShell } from "@voyantjs/admin"
import { type CurrentUser, useCurrentUser } from "@voyantjs/auth-react"
import { cn } from "@voyantjs/ui/components"
import { type ReactNode, useMemo } from "react"

import {
  AccountChangeEmailForm,
  AccountChangePasswordForm,
  AccountProfileForm,
} from "./account-forms.js"
import {
  type AccountPageMessages,
  type AccountPageRenderContext,
  type AccountPageSlot,
  type AccountPageSlots,
  mergeAccountPageMessages,
  type PartialAccountPageMessages,
} from "./account-page-shared.js"

export {
  AccountChangeEmailForm,
  type AccountChangeEmailFormProps,
  AccountChangePasswordForm,
  type AccountChangePasswordFormProps,
  AccountProfileForm,
  type AccountProfileFormProps,
} from "./account-forms.js"
export {
  type AccountChangeEmailFormMessages,
  type AccountChangePasswordFormMessages,
  type AccountPageMessages,
  type AccountPageRenderContext,
  type AccountPageSlot,
  type AccountPageSlots,
  type AccountProfileFormMessages,
  defaultAccountPageMessages,
} from "./account-page-shared.js"

export interface AccountPageProps {
  actions?: ReactNode
  breadcrumbs?: ReactNode
  className?: string
  contentClassName?: string
  currentUser?: CurrentUser | null
  messages?: PartialAccountPageMessages
  slots?: AccountPageSlots
  showSidebarTrigger?: boolean
}

function renderSlot(slot: AccountPageSlot | undefined, context: AccountPageRenderContext) {
  if (typeof slot === "function") {
    return slot(context)
  }

  return slot
}

export function AccountPage({
  actions,
  breadcrumbs,
  className,
  contentClassName,
  currentUser,
  messages: messageOverrides,
  slots,
  showSidebarTrigger,
}: AccountPageProps) {
  const messages: AccountPageMessages = mergeAccountPageMessages(messageOverrides)
  const userQuery = useCurrentUser({ enabled: currentUser === undefined })
  const user = currentUser === undefined ? (userQuery.data ?? null) : currentUser
  const isLoading = currentUser === undefined && userQuery.isLoading
  const isError = currentUser === undefined && userQuery.isError

  const context = useMemo<AccountPageRenderContext>(
    () => ({
      user,
      refreshUser: () => userQuery.refetch(),
    }),
    [user, userQuery],
  )

  return (
    <OperatorAdminPageShell
      actions={actions}
      breadcrumbs={breadcrumbs}
      contentClassName={contentClassName}
      showSidebarTrigger={showSidebarTrigger}
    >
      <div
        data-slot="account-page"
        className={cn("mx-auto flex w-full max-w-5xl flex-col gap-6", className)}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.description}</p>
        </div>

        {isLoading ? (
          <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
            {messages.loading}
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {messages.loadFailed}
          </div>
        ) : null}

        {!isLoading && !isError ? (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <AccountProfileForm currentUser={user} messages={messages.profile} />
              {renderSlot(slots?.profilePanel, context)}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <AccountChangeEmailForm
                currentEmail={user?.email ?? null}
                messages={messages.email}
              />
              <AccountChangePasswordForm messages={messages.password} />
              {renderSlot(slots?.securityPanel, context)}
            </div>

            {renderSlot(slots?.apiTokensPanel, context)}
            {renderSlot(slots?.afterContent, context)}
          </>
        ) : null}
      </div>
    </OperatorAdminPageShell>
  )
}
