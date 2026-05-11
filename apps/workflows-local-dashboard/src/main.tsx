// Local dashboard SPA. Served by `voyant workflows serve` / `voyant
// dev` out of `apps/workflows-local-dashboard/dist/`, same-origin with the run
// API.

import "@voyantjs/ui/globals.css"

import { Alert, AlertDescription, AlertTitle } from "@voyantjs/ui/components/alert"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@voyantjs/ui/components/resizable"
import { StrictMode, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { AppHeader } from "@/components/app-header"
import { AppSidebar, type Route } from "@/components/app-sidebar"
import { EmptyDetail } from "@/components/empty-state"
import { RunDetailPanel } from "@/components/run-detail-panel"
import { RunsTable } from "@/components/runs-table"
import { SchedulesList } from "@/components/schedules-list"
import { TriggerDialog } from "@/components/trigger-dialog"
import { WorkflowsPage } from "@/components/workflows-page"
import { useRunsStream } from "@/hooks/use-runs-stream"
import { useSchedules } from "@/hooks/use-schedules"
import { useWorkflows } from "@/hooks/use-workflows"

function App(): React.ReactElement {
  const { runs, error, live, updateRun } = useRunsStream()
  const workflows = useWorkflows()
  const schedules = useSchedules()
  const isNarrowViewport = useIsNarrowViewport()
  const [route, setRoute] = useState<Route>("runs")
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [workflowFilter, setWorkflowFilter] = useState<string | undefined>(undefined)
  const [triggerOpen, setTriggerOpen] = useState(false)

  const list = useMemo(
    () => (runs ? [...runs.values()].sort((a, b) => b.startedAt - a.startedAt) : []),
    [runs],
  )

  // Global hotkey: N opens the trigger dialog (when not typing in a
  // field). Scoped here because it depends on `workflows.length`.
  useEffect(() => {
    const canTrigger = workflows.length > 0
    const handler = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
        return
      }
      if ((e.key === "n" || e.key === "N") && canTrigger) {
        e.preventDefault()
        setTriggerOpen(true)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [workflows.length])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Failed to load runs</AlertTitle>
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!runs) {
    return (
      <div className="text-muted-foreground flex h-screen items-center justify-center text-sm">
        Loading runs…
      </div>
    )
  }

  // The runs pane always paints the list most-recent-first. When a
  // `workflowFilter` is set, the list scopes to that workflow only —
  // the selected run defaults to the first one that matches.
  const visibleList = workflowFilter ? list.filter((r) => r.workflowId === workflowFilter) : list
  const selected = (selectedId !== undefined ? runs.get(selectedId) : undefined) ?? visibleList[0]

  const onOpenRunsFor = (workflowId: string): void => {
    setWorkflowFilter(workflowId)
    setSelectedId(undefined)
    setRoute("runs")
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        runCount={list.length}
        live={live}
        canTrigger={workflows.length > 0}
        onNewRun={() => setTriggerOpen(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <AppSidebar route={route} onChange={setRoute} />

        <main className="flex min-h-0 flex-1 flex-col">
          {route === "workflows" && (
            <WorkflowsPage
              workflows={workflows}
              runs={list}
              onOpenRuns={onOpenRunsFor}
              onNewRun={() => setTriggerOpen(true)}
            />
          )}

          {route === "runs" && (
            <ResizablePanelGroup
              direction={isNarrowViewport ? "vertical" : "horizontal"}
              className="flex-1 min-h-0"
            >
              <ResizablePanel
                defaultSize={isNarrowViewport ? 44 : 34}
                minSize={isNarrowViewport ? 28 : 22}
                className="flex flex-col"
              >
                <RunsTable
                  runs={visibleList}
                  selectedRunId={selected?.id}
                  onSelectRun={setSelectedId}
                  workflowFilter={workflowFilter}
                  onClearWorkflowFilter={() => {
                    setWorkflowFilter(undefined)
                    setSelectedId(undefined)
                  }}
                />
                <SchedulesList schedules={schedules} />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize={isNarrowViewport ? 56 : 66}
                minSize={isNarrowViewport ? 36 : 40}
              >
                {selected ? (
                  <RunDetailPanel run={selected} onRunUpdated={updateRun} />
                ) : (
                  <EmptyDetail />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </main>
      </div>

      <TriggerDialog
        open={triggerOpen}
        onOpenChange={setTriggerOpen}
        workflows={workflows}
        onTriggered={(newRunId) => {
          setTriggerOpen(false)
          setSelectedId(newRunId)
          setRoute("runs")
        }}
      />
    </div>
  )
}

function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const sync = (): void => setIsNarrow(query.matches)

    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return isNarrow
}

const root = document.getElementById("root")
if (!root) throw new Error("#root not found")
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
