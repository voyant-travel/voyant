"use client"

import {
  Badge,
  Button,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { useEffect, useState } from "react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import type { ChannelRow, ProductOption, SupplierOption } from "../index.js"
import {
  useEffectivePublication,
  useProductPublications,
  useProducts,
  usePublicationMutation,
  useSupplierPublications,
  useSuppliers,
} from "../index.js"

type PublicationDecision = "include" | "exclude"

const defaultPublicationDecision: PublicationDecision = "include"

export function PublicationSheet({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: ChannelRow
}) {
  const { messages } = useDistributionUiI18nOrDefault()
  const page = messages.settings.channelsPage.publication
  const productsQuery = useProducts({ limit: 200, offset: 0, enabled: open })
  const suppliersQuery = useSuppliers({ limit: 200, offset: 0, enabled: open })
  const productRulesQuery = useProductPublications({
    channelId: channel?.id,
    limit: 200,
    offset: 0,
    enabled: open && !!channel,
  })
  const supplierRulesQuery = useSupplierPublications({
    channelId: channel?.id,
    limit: 200,
    offset: 0,
    enabled: open && !!channel,
  })
  const products = productsQuery.data?.data ?? []
  const suppliers = suppliersQuery.data?.data ?? []
  const productRules = productRulesQuery.data?.data ?? []
  const supplierRules = supplierRulesQuery.data?.data ?? []
  const publication = usePublicationMutation()
  const [productId, setProductId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [productDecision, setProductDecision] = useState<PublicationDecision>(
    defaultPublicationDecision,
  )
  const [supplierDecision, setSupplierDecision] = useState<PublicationDecision>(
    defaultPublicationDecision,
  )
  const [productReason, setProductReason] = useState("")
  const [supplierReason, setSupplierReason] = useState("")
  const [inspectorProductId, setInspectorProductId] = useState("")
  const [inspectorSupplierId, setInspectorSupplierId] = useState("")
  const effectiveQuery = useEffectivePublication({
    channelId: channel?.id,
    productId: inspectorProductId,
    canonicalSupplierId: inspectorSupplierId || undefined,
    enabled: open && !!channel && !!inspectorProductId,
  })

  useEffect(() => {
    if (!open) {
      setProductId("")
      setSupplierId("")
      setInspectorProductId("")
      setInspectorSupplierId("")
      setProductDecision(defaultPublicationDecision)
      setSupplierDecision(defaultPublicationDecision)
      setProductReason("")
      setSupplierReason("")
    }
  }, [open])

  const saveProductRule = async () => {
    if (!channel || !productId) return
    await publication.upsertProduct.mutateAsync({
      channelId: channel.id,
      productId,
      decision: productDecision,
      reason: productReason.trim() || null,
    })
    setProductId("")
    setProductReason("")
    await productRulesQuery.refetch()
  }

  const saveSupplierRule = async () => {
    if (!channel || !supplierId) return
    await publication.upsertSupplier.mutateAsync({
      channelId: channel.id,
      supplierId,
      decision: supplierDecision,
      reason: supplierReason.trim() || null,
    })
    setSupplierId("")
    setSupplierReason("")
    await supplierRulesQuery.refetch()
  }

  const previewSupplierRule = async () => {
    if (!channel || !supplierId) return
    await publication.previewSupplier.mutateAsync({
      channelId: channel.id,
      supplierId,
      decision: supplierDecision,
      reason: supplierReason.trim() || null,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>
            {channel ? page.title.replace("{channel}", channel.name) : page.titleEmpty}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-6 overflow-y-auto">
          {channel?.status !== "active" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {page.inactiveWarning}
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">{page.defaultDeny}</p>
          <p className="text-xs text-muted-foreground">{page.precedence}</p>

          <PublicationRuleForm
            idPrefix="publication-product"
            title={page.productsTitle}
            subjectLabel={page.productLabel}
            subjectPlaceholder={page.productPlaceholder}
            subjects={products}
            subjectId={productId}
            setSubjectId={setProductId}
            decision={productDecision}
            setDecision={setProductDecision}
            reason={productReason}
            setReason={setProductReason}
            onSave={saveProductRule}
            saveLabel={page.saveProduct}
            disabled={!channel || publication.upsertProduct.isPending}
          />
          <PublicationRuleList
            empty={page.productsEmpty}
            rules={productRules}
            subjects={products}
            subjectKey="productId"
            includeLabel={page.include}
            excludeLabel={page.exclude}
            noReason={page.noReason}
            onDelete={(id) =>
              publication.removeProduct.mutateAsync(id).then(() => productRulesQuery.refetch())
            }
            deleteLabel={page.deleteRule}
          />

          <PublicationRuleForm
            idPrefix="publication-supplier"
            title={page.suppliersTitle}
            subjectLabel={page.supplierLabel}
            subjectPlaceholder={page.supplierPlaceholder}
            subjects={suppliers}
            subjectId={supplierId}
            setSubjectId={setSupplierId}
            decision={supplierDecision}
            setDecision={setSupplierDecision}
            reason={supplierReason}
            setReason={setSupplierReason}
            onSave={saveSupplierRule}
            onPreview={previewSupplierRule}
            previewResult={
              publication.previewSupplier.data
                ? page.supplierImpact.replace(
                    "{count}",
                    String(publication.previewSupplier.data.affectedProductCount),
                  )
                : null
            }
            saveLabel={page.saveSupplier}
            previewLabel={page.previewSupplier}
            disabled={!channel || publication.upsertSupplier.isPending}
          />
          <PublicationRuleList
            empty={page.suppliersEmpty}
            rules={supplierRules}
            subjects={suppliers}
            subjectKey="supplierId"
            includeLabel={page.include}
            excludeLabel={page.exclude}
            noReason={page.noReason}
            onDelete={(id) =>
              publication.removeSupplier.mutateAsync(id).then(() => supplierRulesQuery.refetch())
            }
            deleteLabel={page.deleteRule}
          />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">{page.whyTitle}</h3>
              <p className="text-xs text-muted-foreground">{page.whyDescription}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectBox
                id="publication-inspector-product"
                label={page.productLabel}
                placeholder={page.productPlaceholder}
                value={inspectorProductId}
                onChange={setInspectorProductId}
                options={products}
              />
              <SelectBox
                id="publication-inspector-supplier"
                label={page.supplierLabel}
                placeholder={page.supplierOptional}
                value={inspectorSupplierId}
                onChange={setInspectorSupplierId}
                options={suppliers}
              />
            </div>
            {effectiveQuery.data?.data ? (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={effectiveQuery.data.data.published ? "default" : "secondary"}>
                    {effectiveQuery.data.data.published ? page.published : page.denied}
                  </Badge>
                  <span className="text-muted-foreground">
                    {page.source.replace("{source}", effectiveQuery.data.data.source)}
                  </span>
                </div>
                <p className="mt-2">{effectiveQuery.data.data.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {page.reason.replace("{reason}", effectiveQuery.data.data.reason)}
                </p>
              </div>
            ) : null}
          </section>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function PublicationRuleForm({
  title,
  idPrefix,
  subjectLabel,
  subjectPlaceholder,
  subjects,
  subjectId,
  setSubjectId,
  decision,
  setDecision,
  reason,
  setReason,
  onSave,
  onPreview,
  previewResult,
  saveLabel,
  previewLabel,
  disabled,
}: {
  title: string
  idPrefix: string
  subjectLabel: string
  subjectPlaceholder: string
  subjects: Array<ProductOption | SupplierOption>
  subjectId: string
  setSubjectId: (value: string) => void
  decision: PublicationDecision
  setDecision: (value: PublicationDecision) => void
  reason: string
  setReason: (value: string) => void
  onSave: () => Promise<void>
  onPreview?: () => Promise<void>
  previewResult?: string | null
  saveLabel: string
  previewLabel?: string
  disabled: boolean
}) {
  const { messages } = useDistributionUiI18nOrDefault()
  const page = messages.settings.channelsPage.publication

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectBox
          id={`${idPrefix}-subject`}
          label={subjectLabel}
          placeholder={subjectPlaceholder}
          value={subjectId}
          onChange={setSubjectId}
          options={subjects}
        />
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-decision`}>{page.decisionLabel}</Label>
          <select
            id={`${idPrefix}-decision`}
            value={decision}
            onChange={(event) => setDecision(event.target.value as PublicationDecision)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="include">{page.include}</option>
            <option value="exclude">{page.exclude}</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-reason`}>{page.reasonLabel}</Label>
        <Textarea
          id={`${idPrefix}-reason`}
          value={reason}
          placeholder={page.reasonPlaceholder}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !subjectId}
          onClick={() => void onSave()}
        >
          {saveLabel}
        </Button>
        {onPreview && previewLabel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!subjectId}
            onClick={() => void onPreview()}
          >
            {previewLabel}
          </Button>
        ) : null}
        {previewResult ? (
          <span className="text-xs text-muted-foreground">{previewResult}</span>
        ) : null}
      </div>
    </section>
  )
}

function PublicationRuleList<
  TRule extends { id: string; decision: PublicationDecision; reason: string | null },
>({
  empty,
  rules,
  subjects,
  subjectKey,
  includeLabel,
  excludeLabel,
  noReason,
  onDelete,
  deleteLabel,
}: {
  empty: string
  rules: TRule[]
  subjects: Array<ProductOption | SupplierOption>
  subjectKey: keyof TRule
  includeLabel: string
  excludeLabel: string
  noReason: string
  onDelete: (id: string) => Promise<unknown>
  deleteLabel: string
}) {
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => {
        const subjectId = String(rule[subjectKey])
        const subject = subjects.find((entry) => entry.id === subjectId)
        return (
          <div
            key={rule.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{subject?.name ?? subjectId}</span>
                <Badge variant={rule.decision === "include" ? "default" : "secondary"}>
                  {rule.decision === "include" ? includeLabel : excludeLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{rule.reason ?? noReason}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(rule.id)}>
              {deleteLabel}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function SelectBox({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: Array<ProductOption | SupplierOption>
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}
