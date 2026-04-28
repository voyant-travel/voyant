import { type CreateActivityInput, useActivityMutation } from "@voyantjs/crm-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/voyant-ui/components"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"
import { Loader2 } from "lucide-react"
import { useState } from "react"

const ACTIVITY_TYPE_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "follow_up", label: "Follow-up" },
] as const

const ACTIVITY_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function CreateActivityDialog({ open, onOpenChange }: Props) {
  const { create, addLink } = useActivityMutation()
  const [subject, setSubject] = useState("")
  const [type, setType] = useState<string>("note")
  const [status, setStatus] = useState<string>("planned")
  const [description, setDescription] = useState("")
  const [entityType, setEntityType] = useState<string>("none")
  const [entityId, setEntityId] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!subject.trim()) {
      setError("Subject is required")
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
      setEntityType("none")
      setEntityId("")
      setType("note")
      setStatus("planned")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create activity")
    }
  }

  const isSubmitting = create.isPending || addLink.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New activity</DialogTitle>
          <DialogDescription>Log a call, email, meeting, or task.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-subject">
              Subject
            </label>
            <Input
              id="act-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Discovery call with Acme"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select
                value={type}
                onValueChange={(value) => setType(value ?? "note")}
                items={ACTIVITY_TYPE_OPTIONS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value ?? "planned")}
                items={ACTIVITY_STATUS_OPTIONS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_STATUS_OPTIONS.map((option) => (
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
              Description
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
              <span className="text-xs font-medium text-muted-foreground">Link to</span>
              <Select
                value={entityType}
                onValueChange={(value) => setEntityType(value ?? "none")}
                items={[
                  { label: "None", value: "none" },
                  { label: "Person", value: "person" },
                  { label: "Organization", value: "organization" },
                  { label: "Opportunity", value: "opportunity" },
                  { label: "Quote", value: "quote" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="act-entity">
                Entity ID
              </label>
              <Input
                id="act-entity"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                disabled={entityType === "none"}
                placeholder="pers_…"
              />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
