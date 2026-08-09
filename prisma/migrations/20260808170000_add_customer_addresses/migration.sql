-- AlterTable
ALTER TABLE "customers" ADD COLUMN "customer_code" TEXT;
ALTER TABLE "customers" ADD COLUMN "position" TEXT;

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- Preserve current single-address customer data as the default address row.
INSERT INTO "customer_addresses" (
    "id",
    "customer_id",
    "label",
    "address",
    "is_default",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    'Primary',
    "address",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "customers"
WHERE "address" IS NOT NULL AND btrim("address") <> '';

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");
CREATE INDEX "customers_customer_code_idx" ON "customers"("customer_code");
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
