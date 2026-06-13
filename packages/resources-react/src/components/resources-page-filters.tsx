"use client"

import { Label } from "@voyantjs/ui/components"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { useResourcesUiI18nOrDefault } from "../i18n/index.js"
import type { ProductOption, SupplierOption } from "../index.js"
import type { ResourcesPageActiveFilter, ResourcesPageTab } from "./resources-page.js"

const ASSIGNMENT_STATUSES = ["reserved", "assigned", "released", "completed", "cancelled"] as const

interface ResourcesFilterPopoverProps {
  activeTab: ResourcesPageTab
  suppliers: SupplierOption[]
  products: ProductOption[]
  supplierFilter: string | null
  setSupplierFilter: (value: string | null) => void
  selectedSupplierOption: SupplierOption | null
  setSelectedSupplierOption: (value: SupplierOption | null) => void
  productFilter: string | null
  setProductFilter: (value: string | null) => void
  selectedProductOption: ProductOption | null
  setSelectedProductOption: (value: ProductOption | null) => void
  activeFilter: ResourcesPageActiveFilter
  setActiveFilter: (value: ResourcesPageActiveFilter) => void
  assignmentStatusFilter: string
  setAssignmentStatusFilter: (value: string) => void
}

export function ResourcesFilterPopover({
  activeTab,
  suppliers,
  products,
  supplierFilter,
  setSupplierFilter,
  selectedSupplierOption,
  setSelectedSupplierOption,
  productFilter,
  setProductFilter,
  selectedProductOption,
  setSelectedProductOption,
  activeFilter,
  setActiveFilter,
  assignmentStatusFilter,
  setAssignmentStatusFilter,
}: ResourcesFilterPopoverProps) {
  const { messages } = useResourcesUiI18nOrDefault()
  const page = messages.resourcesPage

  const activeStatusSelect = (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="resources-filter-active">{page.filters.activeLabel}</Label>
      <Select
        value={activeFilter}
        onValueChange={(value) => setActiveFilter((value ?? "all") as ResourcesPageActiveFilter)}
      >
        <SelectTrigger id="resources-filter-active" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{page.filters.activeAll}</SelectItem>
            <SelectItem value="active">{page.filters.activeOnly}</SelectItem>
            <SelectItem value="inactive">{page.filters.inactiveOnly}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )

  if (activeTab === "resources") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{page.filters.supplierLabel}</Label>
          <AsyncCombobox<SupplierOption>
            value={supplierFilter}
            onChange={(value) => {
              setSupplierFilter(value)
              if (!value) setSelectedSupplierOption(null)
              else {
                const match = suppliers.find((supplier) => supplier.id === value)
                if (match) setSelectedSupplierOption(match)
              }
            }}
            items={suppliers}
            selectedItem={selectedSupplierOption}
            getKey={(supplier) => supplier.id}
            getLabel={(supplier) => supplier.name}
            placeholder={page.filters.supplierAny}
            emptyText={page.filters.supplierEmpty}
            triggerClassName="w-full"
          />
        </div>
        {activeStatusSelect}
      </div>
    )
  }

  if (activeTab === "pools") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{page.filters.productLabel}</Label>
          <AsyncCombobox<ProductOption>
            value={productFilter}
            onChange={(value) => {
              setProductFilter(value)
              if (!value) setSelectedProductOption(null)
              else {
                const match = products.find((product) => product.id === value)
                if (match) setSelectedProductOption(match)
              }
            }}
            items={products}
            selectedItem={selectedProductOption}
            getKey={(product) => product.id}
            getLabel={(product) => product.name}
            placeholder={page.filters.productAny}
            emptyText={page.filters.productEmpty}
            triggerClassName="w-full"
          />
        </div>
        {activeStatusSelect}
      </div>
    )
  }

  if (activeTab === "assignments") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resources-filter-status">{page.filters.assignmentStatusLabel}</Label>
        <Select
          value={assignmentStatusFilter}
          onValueChange={(value) => setAssignmentStatusFilter(value ?? "all")}
        >
          <SelectTrigger id="resources-filter-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{page.filters.assignmentStatusAll}</SelectItem>
              {ASSIGNMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {messages.common.assignmentStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">{page.filters.noAdditionalFilters}</p>
}
