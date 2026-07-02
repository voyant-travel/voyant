WITH ranked_supplier_availability AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "supplier_id", "date"
			ORDER BY "created_at" DESC, "id" DESC
		) AS row_number
	FROM "supplier_availability"
)
DELETE FROM "supplier_availability"
USING ranked_supplier_availability
WHERE
	"supplier_availability"."id" = ranked_supplier_availability."id"
	AND ranked_supplier_availability.row_number > 1;
--> statement-breakpoint
DROP INDEX "idx_supplier_availability_supplier_date";--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_supplier_availability_supplier_date" ON "supplier_availability" USING btree ("supplier_id","date");
