-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'STOCK_IN';
ALTER TYPE "StockMovementType" ADD VALUE 'STOCK_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'STOCK_ADJUSTMENT';

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "order_id" DROP NOT NULL;
