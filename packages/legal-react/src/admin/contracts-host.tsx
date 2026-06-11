"use client"

import { useAdminNavigate } from "@voyantjs/admin"
import { usePerson } from "@voyantjs/crm-react"
import type { ReactElement } from "react"

import { ContractsPage } from "../components/contracts-page.js"
import { ContractDialog } from "./contract-dialog.js"

/**
 * Packaged admin host for the operator-grade contracts list page
 * (packaged-admin RFC Phase 3). Zero-prop: list state stays component-local
 * (no URL search contract), opening a row resolves through the
 * `contract.detail` semantic destination, and the create/edit dialog is the
 * packaged operator-grade {@link ContractDialog} (CRM/supplier/channel
 * pickers bound to their domain react hooks).
 */
export function ContractsHost() {
  const navigateTo = useAdminNavigate()

  return (
    <ContractsPage
      onOpenContract={(id) => navigateTo("contract.detail", { contractId: id })}
      renderContractDialog={(props) => <ContractDialog {...props} />}
      renderPersonCell={(personId) => <ContractPersonNameCell personId={personId} />}
    />
  )
}

function ContractPersonNameCell({ personId }: { personId: string | null }): ReactElement {
  const { data, isLoading } = usePerson(personId ?? undefined, {
    enabled: Boolean(personId),
  })
  if (!personId) return <span className="text-muted-foreground">-</span>
  if (isLoading) return <span className="text-muted-foreground text-xs">...</span>
  if (!data) {
    return (
      <span className="font-mono text-xs text-muted-foreground" title={personId}>
        {personId.slice(0, 16)}...
      </span>
    )
  }
  const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
  return <span className="text-sm">{name || personId.slice(0, 16)}</span>
}
