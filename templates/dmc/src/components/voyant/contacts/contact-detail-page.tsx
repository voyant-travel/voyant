import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ContactAddressesSection } from "./contact-addresses"
import { ContactDialog } from "./contact-dialog"
import {
  type ContactAddressUpsertInput,
  getContactAddressesQueryOptions,
  getContactNotesQueryOptions,
  getContactQueryOptions,
} from "./contact-shared"

export function ContactDetailPage({ id }: { id: string }) {
  const messages = useAdminMessages().contacts.detail
  const { resolvedLocale } = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")

  const { data: contactData, isPending } = useQuery(getContactQueryOptions(id))
  const { data: notesData, refetch: refetchNotes } = useQuery(getContactNotesQueryOptions(id))
  const addressesQuery = useQuery(getContactAddressesQueryOptions(id))

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/contacts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] })
      void navigate({ to: "/contacts" })
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/v1/contacts/${id}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("")
      void refetchNotes()
    },
  })

  const createAddressMutation = useMutation({
    mutationFn: (input: ContactAddressUpsertInput) =>
      api.post(`/v1/crm/people/${id}/addresses`, {
        entityType: "person",
        entityId: id,
        ...input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-addresses", id] })
    },
  })

  const updateAddressMutation = useMutation({
    mutationFn: (input: { addressId: string; patch: ContactAddressUpsertInput }) =>
      api.patch(`/v1/crm/addresses/${input.addressId}`, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-addresses", id] })
    },
  })

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: string) => api.delete(`/v1/crm/addresses/${addressId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-addresses", id] })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const contact = contactData?.data
  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{messages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/contacts" })}>
          {messages.backToContacts}
        </Button>
      </div>
    )
  }

  const displayName =
    contact.type === "company"
      ? (contact.companyName ?? messages.unnamedCompany)
      : [contact.firstName, contact.lastName].filter(Boolean).join(" ") || messages.unnamedContact
  const typeLabel = contact.type === "company" ? messages.typeCompany : messages.typeIndividual
  const relationLabel =
    contact.relation === "client"
      ? messages.relationClient
      : contact.relation === "partner"
        ? messages.relationPartner
        : contact.relation === "supplier"
          ? messages.relationSupplier
          : messages.relationOther
  const addresses = addressesQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/contacts" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {typeLabel}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {relationLabel}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {messages.edit}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(messages.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {messages.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {contact.email && (
              <div>
                <span className="text-muted-foreground">{messages.emailLabel}:</span>{" "}
                <span>{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div>
                <span className="text-muted-foreground">{messages.phoneLabel}:</span>{" "}
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.website && (
              <div>
                <span className="text-muted-foreground">{messages.websiteLabel}:</span>{" "}
                <span>{contact.website}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.preferencesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {contact.preferredLanguage && (
              <div>
                <span className="text-muted-foreground">{messages.languageLabel}:</span>{" "}
                <span>{contact.preferredLanguage}</span>
              </div>
            )}
            {contact.preferredCurrency && (
              <div>
                <span className="text-muted-foreground">{messages.currencyLabel}:</span>{" "}
                <span>{contact.preferredCurrency}</span>
              </div>
            )}
            {contact.tags.length > 0 && (
              <div>
                <span className="text-muted-foreground">{messages.tagsLabel}:</span>{" "}
                <span className="mt-1 flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{messages.createdLabel}:</span>{" "}
              <span>{new Date(contact.createdAt).toLocaleDateString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.updatedLabel}:</span>{" "}
              <span>{new Date(contact.updatedAt).toLocaleDateString(resolvedLocale)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ContactAddressesSection
        addresses={addresses}
        pending={addressesQuery.isPending}
        creating={createAddressMutation.isPending}
        updatingAddressId={updateAddressMutation.variables?.addressId}
        deletingAddressId={
          deleteAddressMutation.isPending
            ? (deleteAddressMutation.variables ?? undefined)
            : undefined
        }
        onCreate={(input) => createAddressMutation.mutateAsync(input).then(() => undefined)}
        onUpdate={(addressId, input) =>
          updateAddressMutation.mutateAsync({ addressId, patch: input }).then(() => undefined)
        }
        onDelete={(addressId) => deleteAddressMutation.mutateAsync(addressId).then(() => undefined)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.notesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={messages.addNotePlaceholder}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              className="self-end"
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate(noteContent.trim())}
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                messages.addNoteButton
              )}
            </Button>
          </div>

          {notesData?.data.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{messages.noNotes}</p>
          )}

          {notesData?.data.map((note) => (
            <div key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleString(resolvedLocale)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <ContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries({ queryKey: ["contact", id] })
          void queryClient.invalidateQueries({ queryKey: ["contacts"] })
        }}
      />
    </div>
  )
}
