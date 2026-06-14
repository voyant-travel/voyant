"use client"

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  useBookingGroupMemberMutation,
  useBookingGroupMutation,
  useBookingGroups,
} from "../index.js"

export interface BookingGroupLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  productId?: string | null
  optionUnitId?: string | null
  onLinked?: (groupId: string) => void
}

type Mode = "join" | "create"

const JOIN_PLACEHOLDER = "__none__"

export function BookingGroupLinkDialog({
  open,
  onOpenChange,
  bookingId,
  productId,
  optionUnitId,
  onLinked,
}: BookingGroupLinkDialogProps) {
  const [mode, setMode] = React.useState<Mode>("join")
  const [selectedGroupId, setSelectedGroupId] = React.useState("")
  const [newGroupLabel, setNewGroupLabel] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const { formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  React.useEffect(() => {
    if (!open) {
      setMode("join")
      setSelectedGroupId("")
      setNewGroupLabel("")
      setError(null)
    }
  }, [open])

  const { data } = useBookingGroups({
    productId: productId ?? undefined,
    optionUnitId: optionUnitId ?? undefined,
    limit: 50,
    enabled: open,
  })
  const groups = data?.data ?? []

  const { create: createGroup } = useBookingGroupMutation()
  const { add: addMember } = useBookingGroupMemberMutation()

  const handleSubmit = async () => {
    setError(null)

    try {
      let targetGroupId = selectedGroupId
      let role: "primary" | "shared" = "shared"

      if (mode === "create") {
        const label =
          newGroupLabel.trim() ||
          `${messages.bookingGroupLinkDialog.labels.generatedLabelPrefix} - ${formatDate(new Date())}`
        const group = await createGroup.mutateAsync({
          kind: "shared_room",
          label,
          productId: productId ?? null,
          optionUnitId: optionUnitId ?? null,
          primaryBookingId: bookingId,
        })
        targetGroupId = group.id
        role = "primary"
      }

      if (!targetGroupId || targetGroupId === JOIN_PLACEHOLDER) {
        setError(messages.bookingGroupLinkDialog.validation.selectGroup)
        return
      }

      await addMember.mutateAsync({
        groupId: targetGroupId,
        bookingId,
        role,
      })

      onOpenChange(false)
      onLinked?.(targetGroupId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : messages.bookingGroupLinkDialog.validation.linkFailed
      setError(message)
    }
  }

  const isSubmitting = createGroup.isPending || addMember.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.bookingGroupLinkDialog.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "join" ? "default" : "ghost"}
              onClick={() => setMode("join")}
            >
              {messages.bookingGroupLinkDialog.modes.join}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "create" ? "default" : "ghost"}
              onClick={() => setMode("create")}
            >
              {messages.bookingGroupLinkDialog.modes.create}
            </Button>
          </div>

          {mode === "join" ? (
            <div className="flex flex-col gap-2">
              <Label>{messages.bookingGroupLinkDialog.fields.existingGroups}</Label>
              <Select
                items={
                  groups.length === 0
                    ? [
                        {
                          label: messages.bookingGroupLinkDialog.placeholders.noExistingGroups,
                          value: JOIN_PLACEHOLDER,
                        },
                      ]
                    : groups.map((g) => ({ label: g.label, value: g.id }))
                }
                value={selectedGroupId || JOIN_PLACEHOLDER}
                onValueChange={(v) => setSelectedGroupId(v === JOIN_PLACEHOLDER ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={messages.bookingGroupLinkDialog.placeholders.selectGroup}
                  />
                </SelectTrigger>
                <SelectContent>
                  {groups.length === 0 ? (
                    <SelectItem value={JOIN_PLACEHOLDER} disabled>
                      {messages.bookingGroupLinkDialog.placeholders.noExistingGroups}
                    </SelectItem>
                  ) : (
                    groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {productId && (
                <p className="text-xs text-muted-foreground">
                  {messages.bookingGroupLinkDialog.hints.productFiltered}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>{messages.bookingGroupLinkDialog.fields.groupLabel}</Label>
              <Input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder={messages.bookingGroupLinkDialog.placeholders.groupLabel}
              />
              <p className="text-xs text-muted-foreground">
                {messages.bookingGroupLinkDialog.hints.primaryMember}
              </p>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === "join" && !selectedGroupId)}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create"
              ? messages.bookingGroupLinkDialog.actions.createAndLink
              : messages.bookingGroupLinkDialog.actions.linkToGroup}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
