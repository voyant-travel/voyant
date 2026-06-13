# @voyantjs/places

Shared physical places for OTA, tour-operator, DMC, and MICE workflows.

`@voyantjs/places` is the forward package name for the existing facilities
runtime. It keeps the current database tables and `facilityId` fields for
compatibility, while new imports should use place vocabulary.

## Scope

Places include meeting points, pickup and dropoff locations, airports, stations,
ports, attractions, restaurants, supplier bases, venues, and accommodation
locations. Hotel/PMS/property-operations workflows are not first-party scope.

Property-oriented exports remain compatibility surfaces for accommodation
resale metadata and will move to an accommodation resale owner before v1.
