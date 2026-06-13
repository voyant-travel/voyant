"use client"

import { BookingCombobox } from "@voyantjs/bookings-react/ui"
import { SupplierCombobox } from "@voyantjs/distribution-react/suppliers/ui"
import { ProductCombobox } from "@voyantjs/inventory-react/ui"
import { OrganizationCombobox, PersonCombobox } from "@voyantjs/relationships-react/ui"
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"

type KnownEntityType = "person" | "organization" | "supplier" | "booking" | "product"
type EntityTypeOption = KnownEntityType | "custom"

const KNOWN_ENTITY_TYPES: KnownEntityType[] = [
  "person",
  "organization",
  "supplier",
  "booking",
  "product",
]

export interface EntityRefPickerMessages {
  entityTypeLabel: string
  entityLabel: string
  customEntityTypeLabel: string
  typePlaceholder: string
  entityPlaceholder: string
  entityTypeLabels: Record<KnownEntityType, string>
}

export interface EntityRefPickerProps {
  entityType: string
  entityId: string
  onChange: (scope: { entityType: string; entityId: string }) => void
  messages: EntityRefPickerMessages
}

function isKnownEntityType(value: string): value is KnownEntityType {
  return KNOWN_ENTITY_TYPES.includes(value as KnownEntityType)
}

export function EntityRefPicker({
  entityType,
  entityId,
  onChange,
  messages,
}: EntityRefPickerProps) {
  const selectedType: EntityTypeOption = isKnownEntityType(entityType) ? entityType : "custom"

  const setEntityType = (nextType: string) => {
    if (nextType === "custom") {
      onChange({ entityType: "", entityId: "" })
      return
    }
    onChange({ entityType: nextType, entityId: "" })
  }

  const setEntityId = (nextId: string | null) => {
    onChange({ entityType, entityId: nextId ?? "" })
  }

  const entityPicker = isKnownEntityType(entityType) ? (
    entityType === "person" ? (
      <PersonCombobox value={entityId || null} onChange={setEntityId} />
    ) : entityType === "organization" ? (
      <OrganizationCombobox value={entityId || null} onChange={setEntityId} />
    ) : entityType === "supplier" ? (
      <SupplierCombobox value={entityId || null} onChange={setEntityId} />
    ) : entityType === "booking" ? (
      <BookingCombobox value={entityId || null} onChange={setEntityId} />
    ) : (
      <ProductCombobox value={entityId || null} onChange={setEntityId} />
    )
  ) : (
    <Input
      value={entityId}
      onChange={(event) => onChange({ entityType, entityId: event.target.value })}
      placeholder={messages.entityPlaceholder}
    />
  )

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label>{messages.entityTypeLabel}</Label>
        <Select
          items={[
            ...KNOWN_ENTITY_TYPES.map((type) => ({
              label: messages.entityTypeLabels[type],
              value: type,
            })),
            { label: messages.customEntityTypeLabel, value: "custom" },
          ]}
          value={selectedType}
          onValueChange={(value) => setEntityType(value ?? "custom")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={messages.typePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {KNOWN_ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {messages.entityTypeLabels[type]}
              </SelectItem>
            ))}
            <SelectItem value="custom">{messages.customEntityTypeLabel}</SelectItem>
          </SelectContent>
        </Select>
        {selectedType === "custom" ? (
          <Input
            value={entityType}
            onChange={(event) => onChange({ entityType: event.target.value, entityId })}
            placeholder={messages.typePlaceholder}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label>{messages.entityLabel}</Label>
        {entityPicker}
      </div>
    </div>
  )
}
