-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'ORDER_COMMIT';
ALTER TYPE "StockMovementType" ADD VALUE 'ORDER_UNCOMMIT';
ALTER TYPE "StockMovementType" ADD VALUE 'ORDER_DELIVERY_DEDUCTION';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "committed_bags" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "committed_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unavailable_bags" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unavailable_kg" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_committed_bags_idx" ON "products"("committed_bags");

-- CreateIndex
CREATE INDEX "products_unavailable_bags_idx" ON "products"("unavailable_bags");
