import {
  Button,
  DialogBody,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyant-travel/ui/components"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyant-travel/ui/components/dialog"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { crmActivityStatuses, crmActivityTypes, crmEntityTypes } from "../i18n/messages.js"
import { type ActivityRecord, type CreateActivityInput, useActivityMutation } from "../index.js"
import { OrganizationCombobox } from "./organization-combobox.js"
import { PersonCombobox } from "./person-combobox.js"

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  initialEntityType?: string
  initialEntityId?: string
  onSuccess?: (activity: ActivityRecord) => void
}

export function CreateActivityDialog({
  open,
  onOpenChange,
  initialEntityType = "none",
  initialEntityId = "",
  onSuccess,
}: Props) {
  const { create, addLink } = useActivityMutation()
  const messages = useCrmUiMessagesOrDefault()
  const [subject, setSubject] = useState("")
  const [type, setType] = useState<string>("note")
  const [status, setStatus] = useState<string>("planned")
  const [description, setDescription] = useState("")
  const [entityType, setEntityType] = useState<string>(initialEntityType)
  const [entityId, setEntityId] = useState(initialEntityId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEntityType(initialEntityType)
    setEntityId(initialEntityId)
  }, [initialEntityId, initialEntityType, open])

  async function handleCreate() {
    if (!subject.trim()) {
      setError(messages.createActivityDialog.validation.subjectRequired)
      return
    }

    setError(null)

    const input: CreateActivityInput = {
      subject: subject.trim(),
      type,
      status,
      description: description.trim() || null,
    }

    try {
      const activity = await create.mutateAsync(input)
      if (entityType !== "none" && entityId.trim()) {
        await addLink.mutateAsync({
          activityId: activity.id,
          input: {
            entityType,
            entityId: entityId.trim(),
            role: "primary",
          },
        })
      }

      setSubject("")
      setDescription("")
      setEntityType(initialEntityType)
      setEntityId(initialEntityId)
      setType("note")
      setStatus("planned")
      onSuccess?.(activity)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.createActivityDialog.validation.createFailed,
      )
    }
  }

  const isSubmitting = create.isPending || addLink.isPending
  const activityTypeOptions = crmActivityTypes.map((value) => ({
    value,
    label: messages.common.activityTypeLabels[value],
  }))
  const activityStatusOptions = crmActivityStatuses.map((value) => ({
    value,
    label: messages.common.activityStatusLabels[value],
  }))
  const entityTypeOptions = crmEntityTypes.map((value) => ({
    value,
    label: messages.common.entityTypeLabels[value],
  }))
  const entityPicker =
    entityType === "person" ? (
      <PersonCombobox value={entityId || null} onChange={(next) => setEntityId(next ?? "")} />
    ) : entityType === "organization" ? (
      <OrganizationCombobox value={entityId || null} onChange={(next) => setEntityId(next ?? "")} />
    ) : (
      <Input
        id="act-entity"
        value={entityId}
        onChange={(event) => setEntityId(event.target.value)}
        disabled={entityType === "none"}
        placeholder={messages.createActivityDialog.placeholders.entityId}
      />
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.createActivityDialog.title}</DialogTitle>
          <DialogDescription>{messages.createActivityDialog.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-subject">
              {messages.createActivityDialog.fields.subject}
            </label>
            <Input
              id="act-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={messages.createActivityDialog.placeholders.subject}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {messages.createActivityDialog.fields.type}
              </span>
              <Select
                value={type}
                onValueChange={(value) => setType(value ?? "note")}
                items={activityTypeOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {messages.createActivityDialog.fields.status}
              </span>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value ?? "planned")}
                items={activityStatusOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-desc">
              {messages.createActivityDialog.fields.description}
            </label>
            <Textarea
              id="act-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {messages.createActivityDialog.fields.linkTo}
              </span>
              <Select
                value={entityType}
                onValueChange={(value) => {
                  setEntityType(value ?? "none")
                  setEntityId("")
                }}
                items={entityTypeOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="act-entity">
                {messages.createActivityDialog.fields.entityId}
              </label>
              {entityPicker}
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {messages.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
