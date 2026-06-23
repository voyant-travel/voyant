"use client"

import { useAdminNavigate } from "@voyant-travel/admin"
import { ProgramsPage } from "../components/programs-page.js"

/**
 * Packaged admin host for the MICE programs list (packaged-admin RFC Phase 3).
 * The landing surface for the MICE domain: every group program (meetings,
 * incentives, conferences, exhibitions) with its lifecycle status, dates, and
 * pax. Opening a row navigates to that program's detail (where its cost sheet
 * and sub-surfaces live) through the `mice.program.detail` semantic
 * destination. All data flows through the shared `@voyant-travel/react`
 * provider context mounted by the workspace shell.
 */
export function MiceProgramsHost() {
  const navigate = useAdminNavigate()

  return (
    <ProgramsPage
      onProgramOpen={(program) => navigate("mice.program.detail", { programId: program.id })}
    />
  )
}
