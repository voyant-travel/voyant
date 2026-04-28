import { useMutation, useQuery } from "@tanstack/react-query"
import { Badge, Button } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  type BookingQuestionData,
  type BookingQuestionOptionData,
  getQuestionOptionsQueryOptions,
  SELECT_TYPES,
} from "./booking-requirements-shared"

export function BookingRequirementsQuestionRow({
  question,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddOption,
  onEditOption,
}: {
  question: BookingQuestionData
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddOption: (nextSort: number) => void
  onEditOption: (option: BookingQuestionOptionData) => void
}) {
  const hasChoices = SELECT_TYPES.has(question.fieldType)
  const { data: optionsData, refetch: refetchOptions } = useQuery({
    ...getQuestionOptionsQueryOptions(question.id),
    enabled: expanded && hasChoices,
  })

  const deleteOption = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/booking-requirements/question-options/${id}`),
    onSuccess: () => {
      void refetchOptions()
    },
  })

  const options = (optionsData?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const nextSort =
    options.length > 0 ? Math.max(...options.map((option) => option.sortOrder)) + 1 : 0

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{question.label}</span>
            {question.code ? (
              <span className="font-mono text-xs text-muted-foreground">{question.code}</span>
            ) : null}
            <Badge variant="outline" className="capitalize">
              {question.fieldType.replace("_", " ")}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {question.target.replace("_", " ")}
            </Badge>
            {question.isRequired ? <Badge variant="default">Required</Badge> : null}
            <Badge variant={question.active ? "default" : "outline"}>
              {question.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {question.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{question.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t bg-muted/30 p-3">
          {!hasChoices ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Choice options only apply to single-select / multi-select field types.
            </p>
          ) : null}

          {hasChoices ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Choices
                </p>
                <Button variant="outline" size="sm" onClick={() => onAddOption(nextSort)}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Choice
                </Button>
              </div>

              {options.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">No choices yet.</p>
              ) : null}

              {options.length > 0 ? (
                <div className="rounded border bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="p-2 text-left font-medium">Sort</th>
                        <th className="p-2 text-left font-medium">Value</th>
                        <th className="p-2 text-left font-medium">Label</th>
                        <th className="p-2 text-left font-medium">Default</th>
                        <th className="p-2 text-left font-medium">Status</th>
                        <th className="w-16 p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((option) => (
                        <tr key={option.id} className="border-b last:border-b-0">
                          <td className="p-2 font-mono">{option.sortOrder}</td>
                          <td className="p-2 font-mono text-muted-foreground">{option.value}</td>
                          <td className="p-2">{option.label}</td>
                          <td className="p-2">
                            {option.isDefault ? (
                              <Badge variant="secondary">Default</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2">
                            <Badge variant={option.active ? "default" : "outline"}>
                              {option.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditOption(option)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm("Delete this choice?")) {
                                    deleteOption.mutate(option.id)
                                  }
                                }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
