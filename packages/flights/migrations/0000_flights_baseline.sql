CREATE TABLE "reference_aircraft" (
	"iata_code" text PRIMARY KEY NOT NULL,
	"icao_code" text,
	"name" text NOT NULL,
	"manufacturer" text,
	"typical_seats" integer
);
--> statement-breakpoint
CREATE TABLE "reference_airlines" (
	"iata_code" text PRIMARY KEY NOT NULL,
	"icao_code" text,
	"name" text NOT NULL,
	"country" text,
	"logo_url" text,
	"alliance" text
);
--> statement-breakpoint
CREATE TABLE "reference_airports" (
	"iata_code" text PRIMARY KEY NOT NULL,
	"icao_code" text,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text,
	"latitude" real,
	"longitude" real
);
