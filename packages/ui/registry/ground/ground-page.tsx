"use client"

import { Bus } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DriversTab } from "./drivers-tab"
import { useRegistryGroundMessagesOrDefault } from "./i18n"
import { OperatorsTab } from "./operators-tab"
import { VehiclesTab } from "./vehicles-tab"

export function GroundPage() {
  const pageMessages = useRegistryGroundMessagesOrDefault().page

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Bus className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <Tabs defaultValue="operators" className="w-full">
        <TabsList>
          <TabsTrigger value="operators">{pageMessages.tabs.operators}</TabsTrigger>
          <TabsTrigger value="vehicles">{pageMessages.tabs.vehicles}</TabsTrigger>
          <TabsTrigger value="drivers">{pageMessages.tabs.drivers}</TabsTrigger>
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
