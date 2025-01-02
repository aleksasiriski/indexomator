ALTER TABLE "person" ADD COLUMN "guarantor_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_guarantor_id_person_id_fk" FOREIGN KEY ("guarantor_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
