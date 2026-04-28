import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  type UpdatePersonInput,
  useOrganization,
  usePerson,
  usePersonMutation,
} from "@voyantjs/crm-react"
import { PersonDialog } from "@voyantjs/crm-ui/components/person-dialog"
import { Button } from "@voyantjs/ui/components"
import { useState } from "react"
import { PersonDetailSkeleton } from "@/components/voyant/crm/person-detail-skeleton"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import type { AddressRecord, AddressUpsertInput } from "./person-addresses"
import {
  type ActivityRecord,
  type ListEnvelope,
  type OpportunityRecord,
  PersonAside,
  PersonMain,
  type PersonNote,
  PersonSidebar,
  PersonTopBar,
} from "./person-detail-sections"

export function PersonDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messages = useAdminMessages().crm.personDetail
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "activities" | "addresses">(
    "overview",
  )
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityRecord["type"]>("note")
  const [activitySubject, setActivitySubject] = useState("")
  const [activityDescription, setActivityDescription] = useState("")

  const openActivityComposer = () => {
    setActivityOpen(true)
    setActiveTab("activities")
  }

  const personQuery = usePerson(id)
  const { remove, update } = usePersonMutation()

  const updateField = async (patch: UpdatePersonInput) => {
    await update.mutateAsync({ id, input: patch })
  }

  const person = personQuery.data

  const organizationQuery = useOrganization(person?.organizationId ?? undefined, {
    enabled: Boolean(person?.organizationId),
  })

  const notesQuery = useQuery({
    queryKey: ["person-notes", id],
    queryFn: () => api.get<ListEnvelope<PersonNote>>(`/v1/crm/people/${id}/notes`),
    enabled: Boolean(person),
  })

  const activitiesQuery = useQuery({
    queryKey: ["person-activities", id],
    queryFn: () =>
      api.get<ListEnvelope<ActivityRecord>>(
        `/v1/crm/activities?entityType=person&entityId=${id}&limit=50`,
      ),
    enabled: Boolean(person),
  })

  const opportunitiesQuery = useQuery({
    queryKey: ["person-opportunities", id],
    queryFn: () =>
      api.get<ListEnvelope<OpportunityRecord>>(`/v1/crm/opportunities?personId=${id}&limit=20`),
    enabled: Boolean(person),
  })

  const addressesQuery = useQuery({
    queryKey: ["person-addresses", id],
    queryFn: () => api.get<{ data: AddressRecord[] }>(`/v1/crm/people/${id}/addresses`),
    enabled: Boolean(person),
  })

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      api.post<{ data: PersonNote }>(`/v1/crm/people/${id}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("")
      void queryClient.invalidateQueries({ queryKey: ["person-notes", id] })
    },
  })

  const addActivityMutation = useMutation({
    mutationFn: async (input: {
      type: ActivityRecord["type"]
      subject: string
      description: string
    }) => {
      const created = await api.post<{ data: ActivityRecord }>("/v1/crm/activities", {
        type: input.type,
        subject: input.subject,
        status: "planned",
        description: input.description || null,
      })
      await api.post(`/v1/crm/activities/${created.data.id}/links`, {
        entityType: "person",
        entityId: id,
        role: "primary",
      })
      return created.data
    },
    onSuccess: () => {
      setActivitySubject("")
      setActivityDescription("")
      setActivityType("note")
      setActivityOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["person-activities", id] })
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: (input: { noteId: string; content: string }) =>
      api.patch<{ data: PersonNote }>(`/v1/crm/person-notes/${input.noteId}`, {
        content: input.content,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-notes", id] })
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.delete<{ success: true }>(`/v1/crm/person-notes/${noteId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-notes", id] })
    },
  })

  const updateActivityMutation = useMutation({
    mutationFn: (input: {
      activityId: string
      patch: Partial<Pick<ActivityRecord, "subject" | "description" | "type" | "status">>
    }) =>
      api.patch<{ data: ActivityRecord }>(`/v1/crm/activities/${input.activityId}`, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-activities", id] })
    },
  })

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: string) =>
      api.delete<{ success: true }>(`/v1/crm/activities/${activityId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-activities", id] })
    },
  })

  const submitActivity = () => {
    const subject = activitySubject.trim()
    if (!subject || addActivityMutation.isPending) return
    addActivityMutation.mutate({
      type: activityType,
      subject,
      description: activityDescription.trim(),
    })
  }

  const createAddressMutation = useMutation({
    mutationFn: (input: AddressUpsertInput) =>
      api.post<{ data: AddressRecord }>(`/v1/crm/people/${id}/addresses`, {
        entityType: "person",
        entityId: id,
        ...input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-addresses", id] })
    },
  })

  const updateAddressMutation = useMutation({
    mutationFn: (input: { addressId: string; patch: AddressUpsertInput }) =>
      api.patch<{ data: AddressRecord }>(`/v1/crm/addresses/${input.addressId}`, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-addresses", id] })
    },
  })

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: string) =>
      api.delete<{ success: true }>(`/v1/crm/addresses/${addressId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["person-addresses", id] })
    },
  })

  if (personQuery.isPending) {
    return <PersonDetailSkeleton />
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{messages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/people" })}>
          {messages.backAction}
        </Button>
      </div>
    )
  }

  const displayName =
    [person.firstName, person.lastName].filter(Boolean).join(" ") || messages.unnamedPerson
  const notes = notesQuery.data?.data ?? []
  const activities = activitiesQuery.data?.data ?? []
  const opportunities = opportunitiesQuery.data?.data ?? []
  const addresses = addressesQuery.data?.data ?? []
  const organization = organizationQuery.data
    ? {
        id: organizationQuery.data.id,
        name: organizationQuery.data.name,
        legalName: organizationQuery.data.legalName ?? null,
        industry: organizationQuery.data.industry ?? null,
        website: organizationQuery.data.website ?? null,
        relation: organizationQuery.data.relation ?? null,
        status: organizationQuery.data.status,
      }
    : undefined
  const primaryAddress = addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null
  const openOpportunities = opportunities.filter((o) => o.status === "open")
  const wonOpportunities = opportunities.filter((o) => o.status === "won")
  const totalOpenValue = openOpportunities.reduce((sum, o) => sum + (o.valueAmountCents ?? 0), 0)
  const primaryCurrency = opportunities[0]?.valueCurrency ?? null
  const websiteHref = person.website
    ? person.website.startsWith("http")
      ? person.website
      : `https://${person.website}`
    : undefined

  return (
    <div className="flex min-h-screen flex-col">
      <PersonTopBar
        displayName={displayName}
        onBack={() => void navigate({ to: "/people" })}
        onEdit={() => setEditOpen(true)}
        deletePending={remove.isPending}
        onDelete={async () => {
          await remove.mutateAsync(id)
          void navigate({ to: "/people" })
        }}
      />

      <div className="grid flex-1 grid-cols-12 gap-4 p-4 lg:p-6">
        <PersonSidebar
          person={person}
          displayName={displayName}
          organization={organization}
          websiteHref={websiteHref}
          primaryAddress={primaryAddress}
          updateField={async (patch) => updateField(patch as UpdatePersonInput)}
        />

        <PersonMain
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notes={notes}
          notesPending={notesQuery.isPending}
          activities={activities}
          activitiesPending={activitiesQuery.isPending}
          addNoteOpenValue={noteContent}
          setAddNoteOpenValue={setNoteContent}
          addNotePending={addNoteMutation.isPending}
          onAddNote={() => addNoteMutation.mutate(noteContent.trim())}
          onOpenActivityComposer={openActivityComposer}
          activityOpen={activityOpen}
          setActivityOpen={setActivityOpen}
          activityType={activityType}
          setActivityType={setActivityType}
          activitySubject={activitySubject}
          setActivitySubject={setActivitySubject}
          activityDescription={activityDescription}
          setActivityDescription={setActivityDescription}
          addActivityPending={addActivityMutation.isPending}
          onSubmitActivity={submitActivity}
          noteSavingFor={updateNoteMutation.variables?.noteId}
          noteDeletingFor={
            typeof deleteNoteMutation.variables === "string"
              ? deleteNoteMutation.variables
              : undefined
          }
          onSaveNote={(noteId, content) =>
            updateNoteMutation.mutateAsync({ noteId, content }).then(() => undefined)
          }
          onDeleteNote={(noteId) => deleteNoteMutation.mutateAsync(noteId).then(() => undefined)}
          activitySavingFor={updateActivityMutation.variables?.activityId}
          activityDeletingFor={
            typeof deleteActivityMutation.variables === "string"
              ? deleteActivityMutation.variables
              : undefined
          }
          onSaveActivity={(activityId, patch) =>
            updateActivityMutation.mutateAsync({ activityId, patch }).then(() => undefined)
          }
          onDeleteActivity={(activityId) =>
            deleteActivityMutation.mutateAsync(activityId).then(() => undefined)
          }
          onToggleActivityStatus={(activity) =>
            updateActivityMutation
              .mutateAsync({
                activityId: activity.id,
                patch: { status: activity.status === "done" ? "planned" : "done" },
              })
              .then(() => undefined)
          }
          addresses={addresses}
          addressesPending={addressesQuery.isPending}
          addressCreating={createAddressMutation.isPending}
          addressUpdatingFor={updateAddressMutation.variables?.addressId}
          addressDeletingFor={
            typeof deleteAddressMutation.variables === "string"
              ? deleteAddressMutation.variables
              : undefined
          }
          onCreateAddress={(input) =>
            createAddressMutation.mutateAsync(input).then(() => undefined)
          }
          onUpdateAddress={(addressId, input) =>
            updateAddressMutation.mutateAsync({ addressId, patch: input }).then(() => undefined)
          }
          onDeleteAddress={(addressId) =>
            deleteAddressMutation.mutateAsync(addressId).then(() => undefined)
          }
          openOpportunitiesCount={openOpportunities.length}
          wonOpportunitiesCount={wonOpportunities.length}
          totalOpenValue={totalOpenValue}
          primaryCurrency={primaryCurrency}
        />

        <PersonAside
          person={person}
          organization={organization}
          organizationPending={organizationQuery.isPending}
          opportunities={opportunities}
          opportunitiesPending={opportunitiesQuery.isPending}
          updatePending={update.isPending}
          updateField={async (patch) => updateField(patch as UpdatePersonInput)}
        />
      </div>

      <PersonDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        person={person}
        onSuccess={() => {
          setEditOpen(false)
        }}
      />
    </div>
  )
}
