-- Backfill any legacy rows before rebuilding the enum without DELIVERED.
UPDATE "orders"
SET
  "delivery_status" = 'DELIVERED',
  "fulfillment_status" = 'FULFILLED',
  "order_status" = CASE
    WHEN "payment_status" = 'PAID' THEN 'COMPLETED'::"OrderStatus"
    ELSE 'ACTIVE'::"OrderStatus"
  END
WHERE "fulfillment_status" = 'DELIVERED';

-- Rebuild FulfillmentStatus because PostgreSQL cannot safely drop enum values in-place.
ALTER TABLE "orders" ALTER COLUMN "fulfillment_status" DROP DEFAULT;

CREATE TYPE "FulfillmentStatus_new" AS ENUM ('UNFULFILLED', 'FULFILLED');

ALTER TABLE "orders"
ALTER COLUMN "fulfillment_status" TYPE "FulfillmentStatus_new"
USING ("fulfillment_status"::text::"FulfillmentStatus_new");

ALTER TYPE "FulfillmentStatus" RENAME TO "FulfillmentStatus_old";
ALTER TYPE "FulfillmentStatus_new" RENAME TO "FulfillmentStatus";
DROP TYPE "FulfillmentStatus_old";

ALTER TABLE "orders"
ALTER COLUMN "fulfillment_status" SET DEFAULT 'UNFULFILLED';

-- Keep high-level status consistent with the final three-status model.
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
