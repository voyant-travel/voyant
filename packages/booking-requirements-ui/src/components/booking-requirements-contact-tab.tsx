import type { ContactRequirement } from "@voyantjs/booking-requirements-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"

export function BookingRequirementsContactTab({
  rows,
  onCreate,
  onEdit,
  onDelete,
}: {
  rows: ContactRequirement[]
  onCreate: () => void
  onEdit: (row: ContactRequirement) => void
  onDelete: (row: ContactRequirement) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contact Requirements</h2>
          <p className="text-sm text-muted-foreground">
            Standard traveler fields collected at booking (name, email, passport, etc.).
          </p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Requirement
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No contact requirements yet. Add one to start collecting traveler data.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Field</th>
                <th className="p-3 text-left font-medium">Scope</th>
                <th className="p-3 text-left font-medium">Required</th>
                <th className="p-3 text-left font-medium">Per Traveler</th>
                <th className="p-3 text-left font-medium">Sort</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-3 font-medium capitalize">{row.fieldKey.replace(/_/g, " ")}</td>
                  <td className="p-3 capitalize text-muted-foreground">
                    {row.scope.replace("_", " ")}
                  </td>
                  <td className="p-3">
                    {row.isRequired ? (
                      <Badge variant="default">Required</Badge>
                    ) : (
                      <Badge variant="outline">Optional</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {row.perTraveler ? (
                      <Badge variant="secondary">Yes</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">{row.sortOrder}</td>
                  <td className="p-3">
                    <Badge variant={row.active ? "default" : "outline"}>
                      {row.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
