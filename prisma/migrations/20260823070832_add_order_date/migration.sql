-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");
