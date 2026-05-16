import { createFileRoute } from "@tanstack/react-router"

import { ActionApprovalsPage } from "@/components/voyant/action-ledger/action-approvals-page"

export const Route = createFileRoute("/_workspace/action-ledger/approvals")({
  component: ActionApprovalsPage,
})
