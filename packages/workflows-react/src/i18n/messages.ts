import type { WorkflowRunStatus, WorkflowRunStepStatus } from "../types.js"

export type WorkflowRunsUiMessages = {
  page: {
    title: string
    subtitle: string
    filterTitle: string
    workflowLabel: string
    workflowPlaceholder: string
    workflowEmpty: string
    searchLabel: string
    searchPlaceholder: string
    statusLabel: string
    tagLabel: string
    tagPlaceholder: string
    tagEmpty: string
    addTag: string
    removeTag: string
    timeRangeLabel: string
    live: string
    clearFilters: string
    anyStatus: string
    empty: string
    selectPrompt: string
    loading: string
    loadError: string
    runCount: (count: number) => string
    filteredRunCount: (filtered: number, total: number) => string
    timeRanges: {
      "15m": string
      "1h": string
      "24h": string
      "7d": string
      all: string
    }
  }
  status: Record<WorkflowRunStatus, string>
  stepStatus: Record<WorkflowRunStepStatus, string>
  detail: {
    trigger: string
    correlation: string
    parent: string
    triggeredBy: string
    tags: string
    started: string
    finished: string
    steps: string
    noSteps: string
    input: string
    output: string
    result: string
    runError: string
    stackTrace: string
    copy: string
    copied: string
    code: string
    step: string
    reruns: string
    resumedAt: (step: string) => string
    durationUnavailable: string
  }
  actions: {
    rerun: string
    rerunBusy: string
    resume: string
    resumeBusy: string
    waitForCompletion: string
    rerunDescription: string
    resumeDescription: string
    resumeUnavailable: string
    actionFailed: string
    rerunStarted: string
    resumeStarted: (step: string) => string
    runnerMissing: string
    rerunBlocked: string
    incompletePriorStep: string
    confirmTitle: string
    confirmBody: string
    confirmTip: string
    cancel: string
    rerunAnyway: string
  }
  format: {
    relativeNow: string
  }
  schedules: {
    title: string
    subtitle: string
    environmentLabel: string
    versionLabel: string
    workflowColumn: string
    scheduleColumn: string
    nextRunColumn: string
    lastRunColumn: string
    statusColumn: string
    actionsColumn: string
    enabled: string
    disabledByRegistration: string
    disabledByEnvironment: string
    disabledByEnvFlag: string
    envFlagOff: string
    envFlagOn: string
    eventDriven: string
    cron: (expr: string, timezone: string) => string
    every: (interval: string) => string
    at: (timestamp: string) => string
    triggerNow: string
    triggering: string
    triggerSuccess: string
    triggerFailed: string
    refresh: string
    loading: string
    loadError: string
    empty: string
    inFuture: (relative: string) => string
    inPast: (relative: string) => string
    notScheduled: string
    lastRunSucceeded: (relative: string) => string
    lastRunFailed: (relative: string) => string
    lastRunRunning: string
    lastRunCancelled: (relative: string) => string
    lastFireRecorded: (relative: string) => string
    lastRunNone: string
  }
}
