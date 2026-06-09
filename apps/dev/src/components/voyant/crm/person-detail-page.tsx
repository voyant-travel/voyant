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
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/api-client"
import {
  ACTIVITY_TYPES,
  type ActivityRecord,
  type ListEnvelope,
  PersonAside,
  PersonMain,
  type PersonNote,
  PersonSidebar,
  PersonTopBar,
  type QuoteRecord,
} from "./person-detail-sections"

export function PersonDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "activities">("overview")
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityRecord["type"]>(ACTIVITY_TYPES[0].value)
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

  const quotesQuery = useQuery({
    queryKey: ["person-quotes", id],
    queryFn: () => api.get<ListEnvelope<QuoteRecord>>(`/v1/crm/quotes?personId=${id}&limit=20`),
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
      setActivityType(ACTIVITY_TYPES[0].value)
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

  if (personQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Person not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/people" })}>
          Back to People
        </Button>
      </div>
    )
  }

  const displayName =
    [person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed person"
  const notes = notesQuery.data?.data ?? []
  const activities = activitiesQuery.data?.data ?? []
  const quotes = quotesQuery.data?.data ?? []
  const organization = organizationQuery.data
  const openQuotes = quotes.filter((o) => o.status === "open")
  const wonQuotes = quotes.filter((o) => o.status === "won")
  const totalOpenValue = openQuotes.reduce((sum, o) => sum + (o.valueAmountCents ?? 0), 0)
  const primaryCurrency = quotes[0]?.valueCurrency ?? null
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
          openQuotesCount={openQuotes.length}
          wonQuotesCount={wonQuotes.length}
          totalOpenValue={totalOpenValue}
          primaryCurrency={primaryCurrency}
        />

        <PersonAside
          person={person}
          organization={organization}
          organizationPending={organizationQuery.isPending}
          quotes={quotes}
          quotesPending={quotesQuery.isPending}
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
