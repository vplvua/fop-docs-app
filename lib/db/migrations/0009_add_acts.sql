-- S7: acts table (stub for classification, extended by S8/S9)
CREATE TYPE "public"."act_status" AS ENUM ('draft', 'sent_to_edo', 'signed', 'deleted');

CREATE TABLE "acts" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id"           uuid NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
  "payment_id"          uuid NOT NULL,
  "status"              "act_status" NOT NULL DEFAULT 'draft',
  "service_type"        text NOT NULL,
  "unit_price"          numeric(10, 2) NOT NULL,
  "quantity"            numeric(10, 2) NOT NULL,
  "quantity_unit"       text NOT NULL,
  "act_date"            date NOT NULL,
  "number"              text NOT NULL,
  "client_snapshot"     jsonb NOT NULL,
  "contract_snapshot"   jsonb NOT NULL,
  "service_description" text NOT NULL,
  "edo_provider"        "edo_provider" NOT NULL,
  "pdf_file_url"        text,
  "edo_doc_id"          text,
  "edo_status"          text,
  "sent_to_edo_at"      timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "acts_client_date_number_unique"
  ON "acts" ("client_id", "act_date", "number");

-- FK: payments.act_id → acts.id ON DELETE SET NULL
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_act_id_acts_id_fk"
  FOREIGN KEY ("act_id") REFERENCES "acts"("id") ON DELETE SET NULL;

-- FK: acts.payment_id → payments.id (no cascade — manual cleanup)
ALTER TABLE "acts"
  ADD CONSTRAINT "acts_payment_id_payments_id_fk"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id");
