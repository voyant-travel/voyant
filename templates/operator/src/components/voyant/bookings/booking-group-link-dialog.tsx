"use client"

import {
  useBookingGroupMemberMutation,
  useBookingGroupMutation,
  useBookingGroups,
} from "@voyantjs/bookings-react"
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
} from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

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
  const groupMessages = useAdminMessages().bookings.detail.groupLinkDialog
  const { resolvedLocale } = useLocale()
  const [mode, setMode] = React.useState<Mode>("join")
  const [selectedGroupId, setSelectedGroupId] = React.useState("")
  const [newGroupLabel, setNewGroupLabel] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

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
          `${groupMessages.createDefaultLabelPrefix} — ${new Date().toLocaleDateString(resolvedLocale)}`
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
        setError(groupMessages.validationSelectGroup)
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
      const message = err instanceof Error ? err.message : groupMessages.linkFailed
      setError(message)
    }
  }

  const isSubmitting = createGroup.isPending || addMember.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{groupMessages.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "join" ? "default" : "ghost"}
              onClick={() => setMode("join")}
            >
              {groupMessages.joinExisting}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "create" ? "default" : "ghost"}
              onClick={() => setMode("create")}
            >
              {groupMessages.createNew}
            </Button>
          </div>

          {mode === "join" ? (
            <div className="flex flex-col gap-2">
              <Label>{groupMessages.existingGroupsLabel}</Label>
              <Select
                value={selectedGroupId || JOIN_PLACEHOLDER}
                onValueChange={(v) => setSelectedGroupId(v === JOIN_PLACEHOLDER ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={groupMessages.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {groups.length === 0 ? (
                    <SelectItem value={JOIN_PLACEHOLDER} disabled>
                      {groupMessages.noExistingGroups}
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
                <p className="text-xs text-muted-foreground">{groupMessages.filteredHint}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>{groupMessages.groupLabelLabel}</Label>
              <Input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder={groupMessages.groupLabelPlaceholder}
              />
              <p className="text-xs text-muted-foreground">{groupMessages.primaryHint}</p>
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
            {groupMessages.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === "join" && !selectedGroupId)}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? groupMessages.createAndLink : groupMessages.linkToGroup}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
