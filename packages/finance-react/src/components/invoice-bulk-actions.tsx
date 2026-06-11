import { formatMessage } from "@voyantjs/i18n"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  ConfirmActionButton,
  SelectionActionBar,
} from "@voyantjs/ui/components"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import type { InvoiceBulkStatusResult } from "../index.js"

export interface InvoiceBulkActionsProps {
  selectedCount: number
  result: InvoiceBulkStatusResult | null
  pending: boolean
  onClear: () => void
  onMarkPaid: () => unknown
}

export function InvoiceBulkActions({
  selectedCount,
  result,
  pending,
  onClear,
  onMarkPaid,
}: InvoiceBulkActionsProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const bulkActions = messages.invoicesPage.bulkActions

  return (
    <>
      {selectedCount > 0 && (
        <SelectionActionBar
          selectedCount={selectedCount}
          onClear={onClear}
          clearLabel={bulkActions.clearSelection}
          selectionSummary={formatMessage(bulkActions.selectionSummary, {
            count: selectedCount,
          })}
        >
          <ConfirmActionButton
            buttonLabel={bulkActions.markPaid}
            confirmLabel={bulkActions.markPaidConfirm}
            cancelLabel={messages.common.cancel}
            title={formatMessage(bulkActions.markPaidTitle, { count: selectedCount })}
            description={bulkActions.markPaidDescription}
            disabled={pending}
            onConfirm={async () => {
              await onMarkPaid()
            }}
          />
        </SelectionActionBar>
      )}

      {result && (
        <Alert variant={result.failed.length > 0 ? "destructive" : "default"}>
          <AlertTitle>
            {result.failed.length > 0 ? bulkActions.partialTitle : bulkActions.successTitle}
          </AlertTitle>
          <AlertDescription>
            {formatMessage(
              result.failed.length > 0
                ? bulkActions.partialDescription
                : bulkActions.successDescription,
              {
                updated: result.updated.length,
                failed: result.failed.length,
                total: result.total,
              },
            )}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
