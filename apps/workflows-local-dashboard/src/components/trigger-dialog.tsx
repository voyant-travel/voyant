// "New run" modal. Searchable combobox for the workflow picker and a
// CodeMirror-based JSON editor for the input payload.

import { Alert, AlertDescription } from "@voyantjs/ui/components/alert"
import { Button } from "@voyantjs/ui/components/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { Label } from "@voyantjs/ui/components/label"
import { useMemo, useState } from "react"

import { JsonEditor } from "@/components/json-editor"
import { triggerRun, type WorkflowSummary } from "@/lib/api"

export function TriggerDialog({
  open,
  onOpenChange,
  workflows,
  onTriggered,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflows: WorkflowSummary[]
  onTriggered: (newRunId: string) => void
}): React.ReactElement {
  const [workflowId, setWorkflowId] = useState<string>(workflows[0]?.id ?? "")
  const [inputText, setInputText] = useState<string>("{}")
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "in-flight" } | { kind: "error"; message: string }
  >({ kind: "idle" })

  const selected = workflows.find((w) => w.id === workflowId)
  const items = useMemo(
    () => workflows.map((w) => ({ value: w.id, label: w.id, description: w.description })),
    [workflows],
  )

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    let input: unknown
    try {
      input = inputText.trim() === "" ? undefined : JSON.parse(inputText)
    } catch (err) {
      setState({ kind: "error", message: `input JSON is invalid: ${String(err)}` })
      return
    }
    setState({ kind: "in-flight" })
    const result = await triggerRun(workflowId, input)
    if (!result.ok) {
      setState({ kind: "error", message: result.message })
      return
    }
    setState({ kind: "idle" })
    onTriggered(result.runId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Trigger a new run</DialogTitle>
          <DialogDescription>
            Runs execute in this process and appear in the list below as they progress.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow">Workflow</Label>
            <Combobox
              items={items}
              value={workflowId}
              onValueChange={(v) => setWorkflowId(typeof v === "string" ? v : "")}
            >
              <ComboboxInput id="workflow" placeholder="Search workflows…" className="w-full" />
              <ComboboxContent>
                <ComboboxEmpty>No workflows match.</ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(item) => {
                      const it = item as { value: string; label: string; description?: string }
                      return (
                        <ComboboxItem key={it.value} value={it.value}>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-mono text-xs">{it.label}</span>
                            {it.description && (
                              <span className="text-muted-foreground truncate text-[10px]">
                                {it.description}
                              </span>
                            )}
                          </div>
                        </ComboboxItem>
                      )
                    }}
                  </ComboboxCollection>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {selected?.description && (
              <p className="text-muted-foreground text-xs">{selected.description}</p>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="input">Input (JSON)</Label>
            <JsonEditor
              value={inputText}
              onChange={setInputText}
              minHeight="160px"
              aria-label="Input JSON"
            />
          </div>

          {state.kind === "error" && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={state.kind === "in-flight"}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={state.kind === "in-flight" || !workflowId}>
              {state.kind === "in-flight" ? "Running…" : "Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
