import { createFileRoute } from "@tanstack/react-router"

import { ActionLedgerPage } from "@/components/voyant/action-ledger/action-ledger-page"

export const Route = createFileRoute("/_workspace/action-ledger/")({
  component: ActionLedgerPage,
})
