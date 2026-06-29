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
import { useEffect, useState } from "react"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { type StageRecord, useQuoteMutation } from "../index.js"

export interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: StageRecord[]
  onCreated: (id: string) => void
}

export function CreateQuoteDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  onCreated,
}: CreateQuoteDialogProps) {
  const { create } = useQuoteMutation()
  const messages = useCrmUiMessagesOrDefault()
  const [title, setTitle] = useState("")
  const [stageId, setStageId] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle("")
      setStageId(stages[0]?.id ?? "")
      setError(null)
    }
  }, [open, stages])

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError(messages.createQuoteDialog.validation.titleRequired)
      return
    }
    if (!stageId) {
      setError(messages.createQuoteDialog.validation.stageRequired)
      return
    }
    setError(null)
    try {
      const created = await create.mutateAsync({
        title: trimmed,
        pipelineId,
        stageId,
      })
      onCreated(created.id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.createQuoteDialog.validation.createFailed,
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.createQuoteDialog.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registry-quote-title">{messages.createQuoteDialog.fields.title}</Label>
            <Input
              id="registry-quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={messages.createQuoteDialog.placeholders.title}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registry-quote-stage">{messages.createQuoteDialog.fields.stage}</Label>
            <Select
              items={stages.map((stage) => ({ label: stage.name, value: stage.id }))}
              value={stageId}
              onValueChange={(value) => setStageId(value ?? "")}
            >
              <SelectTrigger id="registry-quote-stage" className="w-full">
                <SelectValue>
                  {(value) =>
                    stages.find((stage) => stage.id === value)?.name ??
                    messages.createQuoteDialog.placeholders.stage
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {messages.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
