"use client"

import { Badge } from "@voyant-travel/ui/components/badge"

import { useProgram, useProgramCostSheet } from "../hooks/use-programs.js"
import { ProgramCostSheetPanel } from "./program-cost-sheet-panel.js"
import { ProgramSessionsSection } from "./program-sessions-section.js"

export interface ProgramDetailPageProps {
  programId: string
}

export function ProgramDetailPage({ programId }: ProgramDetailPageProps) {
  const { data: programResponse, isLoading } = useProgram(programId)
  const { data: costSheetResponse } = useProgramCostSheet(programId)
  const program = programResponse?.data

  if (isLoading && !program) {
    return <div className="p-6 text-muted-foreground text-sm">Loading…</div>
  }
  if (!program) {
    return <div className="p-6 text-muted-foreground text-sm">Program not found.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">{program.name}</h1>
          <Badge variant="outline" className="capitalize">
            {program.type}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {program.status}
          </Badge>
        </div>
        {program.destination ? (
          <p className="text-muted-foreground text-sm">{program.destination}</p>
        ) : null}
      </div>

      {costSheetResponse?.data ? (
        <ProgramCostSheetPanel costSheet={costSheetResponse.data} />
      ) : null}

      <ProgramSessionsSection programId={programId} />
    </div>
  )
}
