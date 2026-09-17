-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "StockBatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'REVERSED');

-- AlterEnum
ALTER TYPE "IdSequenceKey" ADD VALUE 'IMPORT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'IMPORT_IN';
ALTER TYPE "StockMovementType" ADD VALUE 'ORDER_DELIVERED';
ALTER TYPE "StockMovementType" ADD VALUE 'ORDER_CANCEL_RESTORE';
ALTER TYPE "StockMovementType" ADD VALUE 'IMPORT_REVERSE';
ALTER TYPE "StockMovementType" ADD VALUE 'MANUAL_ADJUSTMENT';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "import_shipment_id" TEXT,
ADD COLUMN     "stock_batch_id" TEXT;

-- CreateTable
CREATE TABLE "import_shipments" (
    "id" TEXT NOT NULL,
    "import_no" TEXT NOT NULL,
    "import_date" TIMESTAMPTZ(6) NOT NULL,
    "supplier_name" TEXT,
    "reference_no" TEXT,
    "container_no" TEXT,
    "notes" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'DRAFT',
    "total_kg" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_bags" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount_paid_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_usd_converted_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_undiyal_paid_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_duty_tax_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_clearing_charges_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_miscellaneous_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_shipment_cost_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_expected_revenue_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_expected_profit_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expected_profit_margin_percentage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "created_by_role" "CreatedByRole",
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "reversed_at" TIMESTAMPTZ(6),
    "reversed_by_user_id" UUID,
    "reverse_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "import_shipment_id" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_kg" DECIMAL(14,2) NOT NULL,
    "kg_per_bag" DECIMAL(10,2) NOT NULL,
    "quantity_bags" DECIMAL(14,2) NOT NULL,
    "usd_amount_per_kg" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "amount_paid_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "exchange_rate_lkr_usd" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "usd_converted_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "undiyal_paid_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "duty_tax_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "clearing_charges_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "miscellaneous_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "final_item_cost_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_per_kg_lkr" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cost_per_bag_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "selling_price_per_kg_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expected_revenue_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expected_profit_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expected_profit_margin_percentage" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "import_shipment_id" TEXT NOT NULL,
    "import_item_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL,
    "import_date" TIMESTAMPTZ(6) NOT NULL,
    "initial_kg" DECIMAL(14,2) NOT NULL,
    "initial_bags" DECIMAL(14,2) NOT NULL,
    "remaining_kg" DECIMAL(14,2) NOT NULL,
    "remaining_bags" DECIMAL(14,2) NOT NULL,
    "kg_per_bag" DECIMAL(10,2) NOT NULL,
    "cost_per_kg_lkr" DECIMAL(14,4) NOT NULL,
    "cost_per_bag_lkr" DECIMAL(14,2) NOT NULL,
    "status" "StockBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_batch_allocations" (
    "id" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "stock_batch_id" TEXT NOT NULL,
    "quantity_kg" DECIMAL(14,2) NOT NULL,
    "quantity_bags" DECIMAL(14,2) NOT NULL,
    "cost_per_kg_lkr" DECIMAL(14,4) NOT NULL,
    "total_cost_lkr" DECIMAL(14,2) NOT NULL,
    "restored_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_batch_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_shipments_import_no_key" ON "import_shipments"("import_no");

-- CreateIndex
CREATE INDEX "import_shipments_status_import_date_idx" ON "import_shipments"("status", "import_date");

-- CreateIndex
CREATE INDEX "import_shipments_supplier_name_idx" ON "import_shipments"("supplier_name");

-- CreateIndex
CREATE INDEX "import_items_import_shipment_id_idx" ON "import_items"("import_shipment_id");

-- CreateIndex
CREATE INDEX "import_items_product_id_idx" ON "import_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_import_item_id_key" ON "stock_batches"("import_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_batch_no_key" ON "stock_batches"("batch_no");

-- CreateIndex
CREATE INDEX "stock_batches_product_id_status_import_date_idx" ON "stock_batches"("product_id", "status", "import_date");

-- CreateIndex
CREATE INDEX "stock_batches_import_shipment_id_idx" ON "stock_batches"("import_shipment_id");

-- CreateIndex
CREATE INDEX "order_item_batch_allocations_order_id_idx" ON "order_item_batch_allocations"("order_id");

-- CreateIndex
CREATE INDEX "order_item_batch_allocations_order_item_id_idx" ON "order_item_batch_allocations"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_batch_allocations_product_id_idx" ON "order_item_batch_allocations"("product_id");

-- CreateIndex
CREATE INDEX "order_item_batch_allocations_stock_batch_id_idx" ON "order_item_batch_allocations"("stock_batch_id");

-- CreateIndex
CREATE INDEX "stock_movements_import_shipment_id_idx" ON "stock_movements"("import_shipment_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_batch_id_idx" ON "stock_movements"("stock_batch_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_import_shipment_id_fkey" FOREIGN KEY ("import_shipment_id") REFERENCES "import_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_import_shipment_id_fkey" FOREIGN KEY ("import_shipment_id") REFERENCES "import_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_import_shipment_id_fkey" FOREIGN KEY ("import_shipment_id") REFERENCES "import_shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_import_item_id_fkey" FOREIGN KEY ("import_item_id") REFERENCES "import_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batch_allocations" ADD CONSTRAINT "order_item_batch_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batch_allocations" ADD CONSTRAINT "order_item_batch_allocations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batch_allocations" ADD CONSTRAINT "order_item_batch_allocations_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
