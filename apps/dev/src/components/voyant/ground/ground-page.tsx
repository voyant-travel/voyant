import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { Bus } from "lucide-react"
import { DriversTab } from "./drivers-tab"
import { OperatorsTab } from "./operators-tab"
import { VehiclesTab } from "./vehicles-tab"

export function GroundPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Bus className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Ground Operations</h1>
      </div>

      <Tabs defaultValue="operators" className="w-full">
        <TabsList>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
        </TabsList>
        <TabsContent value="operators" className="mt-4">
          <OperatorsTab />
        </TabsContent>
        <TabsContent value="vehicles" className="mt-4">
          <VehiclesTab />
        </TabsContent>
        <TabsContent value="drivers" className="mt-4">
          <DriversTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
