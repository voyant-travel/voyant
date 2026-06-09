import { type StageRecord, usePipelineMutation } from "@voyantjs/crm-react"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@voyantjs/ui/components"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

export function CreatePipelineDialog({
  open,
  onOpenChange,
  existingCount,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingCount: number
  onCreated: (pipelineId: string) => void
}) {
  const { createPipeline } = usePipelineMutation()
  const [name, setName] = useState("")
  const [isDefault, setIsDefault] = useState(existingCount === 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setIsDefault(existingCount === 0)
      setError(null)
    }
  }, [open, existingCount])

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Pipeline name is required")
      return
    }
    setError(null)
    try {
      const created = await createPipeline.mutateAsync({
        name: trimmed,
        entityType: "quote",
        isDefault,
      })
      onCreated(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pipeline")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create pipeline</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pipeline-name">Name</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales pipeline"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="pipeline-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="pipeline-default" className="text-sm font-normal">
              Set as default pipeline
            </Label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={createPipeline.isPending}>
            {createPipeline.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ManageStagesDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: StageRecord[]
}) {
  const { createStage, updateStage, removeStage } = usePipelineMutation()
  const [newName, setNewName] = useState("")
  const [newProbability, setNewProbability] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNewName("")
      setNewProbability("")
      setError(null)
    }
  }, [open])

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) {
      setError("Stage name is required")
      return
    }
    const probability = newProbability.trim()
      ? Math.max(0, Math.min(100, Number.parseInt(newProbability, 10) || 0))
      : null
    setError(null)
    try {
      await createStage.mutateAsync({
        pipelineId,
        name: trimmed,
        sortOrder: stages.length,
        probability,
      })
      setNewName("")
      setNewProbability("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stage")
    }
  }

  async function handleRename(stageId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await updateStage.mutateAsync({ id: stageId, input: { name: trimmed } })
    } catch {
      // invalidation restores state
    }
  }

  async function handleRemove(stageId: string) {
    try {
      await removeStage.mutateAsync(stageId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove stage")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage stages</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stages yet. Add one below.</p>
          ) : (
            <ul className="divide-y rounded border">
              {stages.map((stage) => (
                <li key={stage.id} className="flex items-center gap-2 px-2 py-1.5">
                  <Input
                    defaultValue={stage.name}
                    className="h-8 flex-1 text-sm"
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value && value !== stage.name) void handleRename(stage.id, value)
                    }}
                  />
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {stage.probability != null ? `${stage.probability}%` : "—"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => void handleRemove(stage.id)}
                    disabled={removeStage.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 rounded border p-2">
            <p className="text-xs font-medium text-muted-foreground">Add stage</p>
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Stage name"
                className="h-8 flex-1 text-sm"
              />
              <Input
                value={newProbability}
                onChange={(e) => setNewProbability(e.target.value)}
                placeholder="%"
                type="number"
                min={0}
                max={100}
                className="h-8 w-16 text-sm"
              />
              <Button size="sm" onClick={() => void handleAdd()} disabled={createStage.isPending}>
                {createStage.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
