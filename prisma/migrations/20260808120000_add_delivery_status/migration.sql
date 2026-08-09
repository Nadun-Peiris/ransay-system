-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_DISPATCHED', 'DISPATCHED', 'DELIVERED');

-- AlterTable
ALTER TABLE "orders"
ADD COLUMN "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'NOT_DISPATCHED';

-- Backfill legacy delivered fulfillment rows into the new delivery state.
UPDATE "orders"
SET
  "fulfillment_status" = 'FULFILLED',
  "delivery_status" = 'DELIVERED',
  "order_status" = CASE
    WHEN "payment_status" = 'PAID' THEN 'COMPLETED'::"OrderStatus"
    ELSE 'ACTIVE'::"OrderStatus"
  END
WHERE "fulfillment_status" = 'DELIVERED';

-- Keep high-level status consistent after the delivery split.
UPDATE "orders"
SET "order_status" = CASE
  WHEN
    "payment_status" = 'PAID'
    AND "fulfillment_status" = 'FULFILLED'
    AND "delivery_status" = 'DELIVERED'
  THEN 'COMPLETED'::"OrderStatus"
  ELSE 'ACTIVE'::"OrderStatus"
END
WHERE "order_status" NOT IN ('CANCELLED', 'DELETED');

-- CreateIndex
CREATE INDEX "orders_delivery_status_idx" ON "orders"("delivery_status");
