import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@voyantjs/ui/components"
import { Loader2, Plus } from "lucide-react"
import * as React from "react"
import { api } from "@/lib/api-client"
import { BookingQuestionDialog } from "./booking-question-dialog"
import { BookingRequirementsQuestionRow } from "./booking-requirements-question-row"
import type { BookingQuestionData, BookingQuestionOptionData } from "./booking-requirements-shared"
import { getBookingQuestionsQueryOptions } from "./booking-requirements-shared"
import { QuestionOptionDialog } from "./question-option-dialog"

export function BookingRequirementsQuestionsTab({ productId }: { productId: string }) {
  const [questionDialogOpen, setQuestionDialogOpen] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<BookingQuestionData | undefined>()
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [optionDialogOpen, setOptionDialogOpen] = React.useState(false)
  const [optionDialogQuestionId, setOptionDialogQuestionId] = React.useState<string | null>(null)
  const [editingOption, setEditingOption] = React.useState<BookingQuestionOptionData | undefined>()
  const [nextOptionSort, setNextOptionSort] = React.useState(0)
  const { data, isPending, refetch } = useQuery(getBookingQuestionsQueryOptions(productId))

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/booking-requirements/questions/${id}`),
    onSuccess: () => {
      void refetch()
    },
  })

  const rows = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const nextSort = rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0

  const toggleExpand = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom Questions</h2>
          <p className="text-sm text-muted-foreground">
            Product-specific questions asked at booking (dietary needs, preferences, etc.).
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingQuestion(undefined)
            setQuestionDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Add one to collect custom data at booking.
          </p>
        </div>
      ) : null}

      {!isPending && rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rows.map((question) => (
            <BookingRequirementsQuestionRow
              key={question.id}
              question={question}
              expanded={expandedIds.has(question.id)}
              onToggle={() => toggleExpand(question.id)}
              onEdit={() => {
                setEditingQuestion(question)
                setQuestionDialogOpen(true)
              }}
              onDelete={() => {
                if (confirm(`Delete question "${question.label}"?`)) {
                  deleteQuestion.mutate(question.id)
                }
              }}
              onAddOption={(sort) => {
                setOptionDialogQuestionId(question.id)
                setEditingOption(undefined)
                setNextOptionSort(sort)
                setOptionDialogOpen(true)
              }}
              onEditOption={(option) => {
                setOptionDialogQuestionId(question.id)
                setEditingOption(option)
                setOptionDialogOpen(true)
              }}
            />
          ))}
        </div>
      ) : null}

      <BookingQuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        productId={productId}
        question={editingQuestion}
        nextSortOrder={nextSort}
        onSuccess={() => {
          setQuestionDialogOpen(false)
          setEditingQuestion(undefined)
          void refetch()
        }}
      />

      {optionDialogQuestionId ? (
        <QuestionOptionDialog
          open={optionDialogOpen}
          onOpenChange={setOptionDialogOpen}
          questionId={optionDialogQuestionId}
          option={editingOption}
          nextSortOrder={nextOptionSort}
          onSuccess={() => {
            setOptionDialogOpen(false)
            setEditingOption(undefined)
          }}
        />
      ) : null}
    </div>
  )
}
