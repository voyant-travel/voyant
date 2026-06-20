ALTER TABLE "contract_signatures" DROP CONSTRAINT "contract_signatures_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_supplier_id_suppliers_id_fk";
