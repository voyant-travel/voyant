import {
  type BookingQuestion,
  type BookingQuestionOption,
  SELECT_TYPES,
} from "@voyantjs/booking-requirements-react"
import { Badge, Button } from "@voyantjs/voyant-ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"

export function BookingRequirementsQuestionsTab({
  rows,
  expandedIds,
  questionOptionsById,
  onToggle,
  onCreate,
  onEdit,
  onDelete,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  rows: BookingQuestion[]
  expandedIds: Set<string>
  questionOptionsById: Map<string, BookingQuestionOption[]>
  onToggle: (questionId: string) => void
  onCreate: () => void
  onEdit: (question: BookingQuestion) => void
  onDelete: (question: BookingQuestion) => void
  onCreateOption: (question: BookingQuestion, nextSort: number) => void
  onEditOption: (question: BookingQuestion, option: BookingQuestionOption) => void
  onDeleteOption: (option: BookingQuestionOption) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom Questions</h2>
          <p className="text-sm text-muted-foreground">
            Product-specific questions asked at booking (dietary needs, preferences, etc.).
          </p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Add one to collect custom data at booking.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((question) => {
            const expanded = expandedIds.has(question.id)
            const options = (questionOptionsById.get(question.id) ?? []).slice()
            const hasChoices = SELECT_TYPES.has(question.fieldType)
            const nextSort =
              options.length > 0 ? Math.max(...options.map((option) => option.sortOrder)) + 1 : 0

            return (
              <div key={question.id} className="rounded-md border">
                <div className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => onToggle(question.id)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? "Hide" : "Show"}
                  </button>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{question.label}</span>
                      {question.code ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {question.code}
                        </span>
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
                    <Button variant="ghost" size="sm" onClick={() => onEdit(question)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(question)}>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCreateOption(question, nextSort)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Choice
                          </Button>
                        </div>

                        {options.length === 0 ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">
                            No choices yet.
                          </p>
                        ) : (
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
                                    <td className="p-2 font-mono text-muted-foreground">
                                      {option.value}
                                    </td>
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
                                          onClick={() => onEditOption(question, option)}
                                          className="text-muted-foreground hover:text-foreground"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteOption(option)}
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
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
