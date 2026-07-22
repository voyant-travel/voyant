"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Alert, AlertDescription, AlertTitle } from "@voyant-travel/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voyant-travel/ui/components/alert-dialog"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { AlertTriangle } from "lucide-react"
import * as React from "react"

import { OverlayEditor } from "./editorial-overlay-editor.js"
import { useWideCompareLayout, ValuePane } from "./editorial-overlay-panes.js"
import {
  type EditorialMessages,
  type EditorialOverlayField,
  fieldLabel,
  fieldTargetKey,
  isEmptyValue,
  stateBadgeVariant,
  stateLabel,
} from "./types.js"

export interface EditorialOverlayFieldCardProps {
  field: EditorialOverlayField
  messages: EditorialMessages
  canWrite: boolean
  isSaving: boolean
  onSave: (value: unknown) => void
  onClear: () => void
}

export function EditorialOverlayFieldCard({
  field,
  messages,
  canWrite,
  isSaving,
  onSave,
  onClear,
}: EditorialOverlayFieldCardProps) {
  const label = fieldLabel(field, messages)
  const targetKey = fieldTargetKey(field)
  const isWide = useWideCompareLayout()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<unknown>(field.overlayValue)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const headingId = React.useId()

  const hasOverlay = field.overlayValue !== undefined
  const startEditing = () => {
    setDraft(hasOverlay ? field.overlayValue : defaultDraft(field))
    setEditing(true)
  }

  const editor = (
    <div className="flex flex-col gap-2">
      <OverlayEditor
        kind={field.kind}
        value={draft}
        onChange={setDraft}
        messages={messages}
        label={label}
        multiple={field.fieldPath === "/media"}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={() => {
            onSave(draft)
            setEditing(false)
          }}
        >
          {isSaving ? messages.saving : messages.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          {messages.cancel}
        </Button>
      </div>
    </div>
  )

  const sourcePane = (
    <ValuePane
      label={messages.columnSource}
      value={field.sourceValue}
      kind={field.kind}
      emptyLabel={messages.noSourceValue}
      testId={`overlay-source-${targetKey}`}
    />
  )
  const overlayPane = (
    <ValuePane
      label={messages.columnOverlay}
      value={field.overlayValue}
      kind={field.kind}
      emptyLabel={messages.noOverlayValue}
      testId={`overlay-overlay-${targetKey}`}
    >
      {editing ? editor : undefined}
    </ValuePane>
  )
  const effectivePane = (
    <ValuePane
      label={messages.columnEffective}
      value={field.effectiveValue}
      kind={field.kind}
      emptyLabel={messages.noEffectiveValue}
      testId={`overlay-effective-${targetKey}`}
    />
  )

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`overlay-field-${targetKey}`}
      className="flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 id={headingId} className="text-sm font-medium">
            {label}
          </h4>
          <Badge variant={stateBadgeVariant(field.state)}>
            {stateLabel(field.state, messages)}
          </Badge>
          {field.drifted ? <Badge variant="outline">{messages.stateDrifted}</Badge> : null}
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            {editing ? null : (
              <Button type="button" size="sm" variant="outline" onClick={startEditing}>
                {hasOverlay ? messages.edit : messages.add}
              </Button>
            )}
            {hasOverlay ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                {messages.clear}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {field.drifted ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{messages.stateDrifted}</AlertTitle>
          <AlertDescription>{messages.driftedDescription}</AlertDescription>
        </Alert>
      ) : null}
      {field.state === "invalid" ? (
        <Alert variant="destructive">
          <AlertTitle>{messages.stateInvalid}</AlertTitle>
          <AlertDescription>
            {formatMessage(messages.invalidDescription, { reason: field.invalidReason ?? "" })}
          </AlertDescription>
        </Alert>
      ) : null}
      {field.state === "orphaned" ? (
        <Alert variant="destructive">
          <AlertTitle>{messages.stateOrphaned}</AlertTitle>
          <AlertDescription>{messages.orphanedDescription}</AlertDescription>
        </Alert>
      ) : null}

      {isWide ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {sourcePane}
          {overlayPane}
          {effectivePane}
        </div>
      ) : (
        <Tabs defaultValue="source">
          <TabsList aria-label={messages.compareLabel}>
            <TabsTrigger value="source">{messages.columnSource}</TabsTrigger>
            <TabsTrigger value="overlay">{messages.columnOverlay}</TabsTrigger>
            <TabsTrigger value="effective">{messages.columnEffective}</TabsTrigger>
          </TabsList>
          <TabsContent value="source">{sourcePane}</TabsContent>
          <TabsContent value="overlay">{overlayPane}</TabsContent>
          <TabsContent value="effective">{effectivePane}</TabsContent>
        </Tabs>
      )}

      {field.updatedAt ? (
        <p className="text-xs text-muted-foreground">
          {formatMessage(messages.authoredBy, { when: field.updatedAt })}
          {field.origin?.kind ? ` · ${field.origin.kind}` : ""}
        </p>
      ) : null}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.clearFieldTitle}</AlertDialogTitle>
            <AlertDialogDescription>{messages.clearFieldDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.keepEditing}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClear(false)
                onClear()
              }}
            >
              {messages.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

/**
 * Seed a new overlay from an empty value, never from the provider's. Copying
 * source into the overlay would silently detach the field from provider
 * refreshes (RFC #3666 — "revert means delete, not copy").
 */
function defaultDraft(field: EditorialOverlayField): unknown {
  if (field.kind === "string-list") return []
  if (field.kind === "media" && field.fieldPath === "/media") return []
  return isEmptyValue(field.overlayValue) ? "" : field.overlayValue
}
