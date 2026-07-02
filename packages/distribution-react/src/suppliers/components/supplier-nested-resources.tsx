"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import {
  type SupplierAddress,
  type SupplierAvailability,
  type SupplierContactPoint,
  type SupplierContract,
  type SupplierNamedContact,
  useSupplierAddresses,
  useSupplierAddressMutation,
  useSupplierAvailability,
  useSupplierContactMutation,
  useSupplierContactPointMutation,
  useSupplierContactPoints,
  useSupplierContacts,
  useSupplierContractMutation,
  useSupplierContracts,
} from "../index.js"
import {
  AddressDialog,
  ContactPointDialog,
  NamedContactDialog,
} from "./supplier-identity-resource-dialogs.js"
import { AvailabilityDialog, ContractDialog } from "./supplier-operations-resource-dialogs.js"

export interface SupplierNestedResourcesProps {
  supplierId: string
  locale: string
  confirmAction: (message: string) => boolean
}

export function SupplierNestedResources({
  supplierId,
  locale,
  confirmAction,
}: SupplierNestedResourcesProps) {
  const messages = useSuppliersUiMessagesOrDefault()
  const detail = messages.supplierDetailPage

  const contactPointsQuery = useSupplierContactPoints(supplierId)
  const contactsQuery = useSupplierContacts(supplierId)
  const addressesQuery = useSupplierAddresses(supplierId)
  const availabilityQuery = useSupplierAvailability(supplierId)
  const contractsQuery = useSupplierContracts(supplierId)

  const contactPointMutation = useSupplierContactPointMutation(supplierId)
  const contactMutation = useSupplierContactMutation(supplierId)
  const addressMutation = useSupplierAddressMutation(supplierId)
  const contractMutation = useSupplierContractMutation(supplierId)

  const [contactPointDialog, setContactPointDialog] = React.useState<{
    open: boolean
    contactPoint?: SupplierContactPoint
  }>({ open: false })
  const [contactDialog, setContactDialog] = React.useState<{
    open: boolean
    contact?: SupplierNamedContact
  }>({ open: false })
  const [addressDialog, setAddressDialog] = React.useState<{
    open: boolean
    address?: SupplierAddress
  }>({ open: false })
  const [availabilityOpen, setAvailabilityOpen] = React.useState(false)
  const [contractDialog, setContractDialog] = React.useState<{
    open: boolean
    contract?: SupplierContract
  }>({ open: false })

  async function deleteContactPoint(contactPointId: string) {
    if (!confirmAction(detail.deleteContactPointConfirm)) return
    await contactPointMutation.remove.mutateAsync(contactPointId)
  }

  async function deleteContact(contactId: string) {
    if (!confirmAction(detail.deleteNamedContactConfirm)) return
    await contactMutation.remove.mutateAsync(contactId)
  }

  async function deleteAddress(addressId: string) {
    if (!confirmAction(detail.deleteAddressConfirm)) return
    await addressMutation.remove.mutateAsync(addressId)
  }

  async function deleteContract(contractId: string) {
    if (!confirmAction(detail.deleteContractConfirm)) return
    await contractMutation.remove.mutateAsync(contractId)
  }

  const contactPoints = contactPointsQuery.data?.data ?? []
  const contacts = contactsQuery.data?.data ?? []
  const addresses = addressesQuery.data?.data ?? []
  const availability = availabilityQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <ResourceCard
          title={detail.contactPoints}
          actionLabel={detail.addContactPoint}
          onAdd={() => setContactPointDialog({ open: true })}
        >
          {contactPointsQuery.isPending ? (
            <LoadingLine />
          ) : contactPoints.length === 0 ? (
            <EmptyLine>{detail.noContactPoints}</EmptyLine>
          ) : (
            contactPoints.map((contactPoint) => (
              <ResourceRow
                key={contactPoint.id}
                title={contactPoint.value}
                eyebrow={messages.common.contactPointKindLabels[contactPoint.kind]}
                meta={[
                  contactPoint.label,
                  contactPoint.normalizedValue,
                  contactPoint.isPrimary ? detail.labels.primary : null,
                ]}
                notes={contactPoint.notes}
                onEdit={() => setContactPointDialog({ open: true, contactPoint })}
                onDelete={() => void deleteContactPoint(contactPoint.id)}
              />
            ))
          )}
        </ResourceCard>

        <ResourceCard
          title={detail.namedContacts}
          actionLabel={detail.addNamedContact}
          onAdd={() => setContactDialog({ open: true })}
        >
          {contactsQuery.isPending ? (
            <LoadingLine />
          ) : contacts.length === 0 ? (
            <EmptyLine>{detail.noNamedContacts}</EmptyLine>
          ) : (
            contacts.map((contact) => (
              <ResourceRow
                key={contact.id}
                title={contact.name}
                eyebrow={messages.common.namedContactRoleLabels[contact.role]}
                meta={[
                  contact.title,
                  contact.email,
                  contact.phone,
                  contact.isPrimary ? detail.labels.primary : null,
                ]}
                notes={contact.notes}
                onEdit={() => setContactDialog({ open: true, contact })}
                onDelete={() => void deleteContact(contact.id)}
              />
            ))
          )}
        </ResourceCard>

        <ResourceCard
          title={detail.addresses}
          actionLabel={detail.addAddress}
          onAdd={() => setAddressDialog({ open: true })}
        >
          {addressesQuery.isPending ? (
            <LoadingLine />
          ) : addresses.length === 0 ? (
            <EmptyLine>{detail.noAddresses}</EmptyLine>
          ) : (
            addresses.map((address) => (
              <ResourceRow
                key={address.id}
                title={formatAddressTitle(address, messages.common.none)}
                eyebrow={messages.common.addressLabelLabels[address.label]}
                meta={[
                  address.city,
                  address.region,
                  address.postalCode,
                  address.country,
                  address.timezone,
                  address.isPrimary ? detail.labels.primary : null,
                ]}
                notes={address.notes}
                onEdit={() => setAddressDialog({ open: true, address })}
                onDelete={() => void deleteAddress(address.id)}
              />
            ))
          )}
        </ResourceCard>

        <ResourceCard
          title={detail.availability}
          actionLabel={detail.addAvailability}
          onAdd={() => setAvailabilityOpen(true)}
        >
          {availabilityQuery.isPending ? (
            <LoadingLine />
          ) : availability.length === 0 ? (
            <EmptyLine>{detail.noAvailability}</EmptyLine>
          ) : (
            availability.map((entry) => (
              <AvailabilityRow key={entry.id} entry={entry} locale={locale} />
            ))
          )}
        </ResourceCard>

        <ResourceCard
          title={detail.contracts}
          actionLabel={detail.addContract}
          onAdd={() => setContractDialog({ open: true })}
          className="xl:col-span-2"
        >
          {contractsQuery.isPending ? (
            <LoadingLine />
          ) : contracts.length === 0 ? (
            <EmptyLine>{detail.noContracts}</EmptyLine>
          ) : (
            contracts.map((contract) => (
              <ResourceRow
                key={contract.id}
                title={
                  contract.agreementNumber ?? messages.common.contractStatusLabels[contract.status]
                }
                eyebrow={messages.common.contractStatusLabels[contract.status]}
                meta={[
                  `${detail.labels.startDate}: ${formatDateOnly(contract.startDate, locale)}`,
                  contract.endDate
                    ? `${detail.labels.endDate}: ${formatDateOnly(contract.endDate, locale)}`
                    : null,
                  contract.renewalDate
                    ? `${detail.labels.renewalDate}: ${formatDateOnly(contract.renewalDate, locale)}`
                    : null,
                ]}
                notes={contract.terms}
                onEdit={() => setContractDialog({ open: true, contract })}
                onDelete={() => void deleteContract(contract.id)}
              />
            ))
          )}
        </ResourceCard>
      </div>

      <ContactPointDialog
        open={contactPointDialog.open}
        onOpenChange={(open) => setContactPointDialog((current) => ({ ...current, open }))}
        supplierId={supplierId}
        contactPoint={contactPointDialog.contactPoint}
        onSuccess={() => setContactPointDialog({ open: false })}
      />
      <NamedContactDialog
        open={contactDialog.open}
        onOpenChange={(open) => setContactDialog((current) => ({ ...current, open }))}
        supplierId={supplierId}
        contact={contactDialog.contact}
        onSuccess={() => setContactDialog({ open: false })}
      />
      <AddressDialog
        open={addressDialog.open}
        onOpenChange={(open) => setAddressDialog((current) => ({ ...current, open }))}
        supplierId={supplierId}
        address={addressDialog.address}
        onSuccess={() => setAddressDialog({ open: false })}
      />
      <AvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        supplierId={supplierId}
        onSuccess={() => setAvailabilityOpen(false)}
      />
      <ContractDialog
        open={contractDialog.open}
        onOpenChange={(open) => setContractDialog((current) => ({ ...current, open }))}
        supplierId={supplierId}
        contract={contractDialog.contract}
        onSuccess={() => setContractDialog({ open: false })}
      />
    </>
  )
}

function ResourceCard({
  title,
  actionLabel,
  onAdd,
  className,
  children,
}: {
  title: string
  actionLabel: string
  onAdd: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus />
          {actionLabel}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

function ResourceRow({
  title,
  eyebrow,
  meta,
  notes,
  onEdit,
  onDelete,
}: {
  title: string
  eyebrow: string
  meta: Array<string | null | undefined>
  notes?: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const visibleMeta = meta.filter(Boolean)

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{eyebrow}</Badge>
            <p className="min-w-0 break-words text-sm font-medium">{title}</p>
          </div>
          {visibleMeta.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{visibleMeta.join(" | ")}</p>
          )}
          {notes && <p className="mt-2 whitespace-pre-wrap text-sm">{notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="icon" variant="ghost" onClick={onEdit}>
            <Pencil />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  )
}

function AvailabilityRow({ entry, locale }: { entry: SupplierAvailability; locale: string }) {
  const messages = useSuppliersUiMessagesOrDefault()

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.available ? "default" : "secondary"}>
          {entry.available ? messages.common.active : messages.common.inactive}
        </Badge>
        <p className="text-sm font-medium">{formatDateOnly(entry.date, locale)}</p>
      </div>
      {entry.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.notes}</p>}
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>
}

function LoadingLine() {
  return <div className="h-4 w-40 animate-pulse rounded bg-muted" />
}

function formatAddressTitle(address: SupplierAddress, fallback: string) {
  const structured = [
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ")
  return address.fullText || structured || fallback
}

function formatDateOnly(value: string, locale: string) {
  if (!value.includes("T")) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value))
}
