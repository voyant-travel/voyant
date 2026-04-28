import { Link } from "@tanstack/react-router"
import { usePropertyGroup } from "@voyantjs/facilities-react"
import { Badge } from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ArrowLeft, Building, Loader2 } from "lucide-react"
import { MembersTab } from "./members-tab"

type Props = { id: string }

export function PropertyGroupDetailPage({ id }: Props) {
  const { data: group, isPending } = usePropertyGroup(id)

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Property group not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/property-groups" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
        <Building className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <Badge variant="outline" className="capitalize">
          {group.groupType.replace(/_/g, " ")}
        </Badge>
        <Badge variant={group.status === "active" ? "default" : "outline"}>{group.status}</Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Code</p>
              <p className="font-mono text-sm">{group.code ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Brand</p>
              <p className="text-sm">{group.brandName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Legal name</p>
              <p className="text-sm">{group.legalName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              <p className="text-sm">{group.website ?? "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{group.notes ?? "-"}</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <MembersTab groupId={group.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
