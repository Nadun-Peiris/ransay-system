-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('VAT', 'NON_VAT');

-- CreateEnum
CREATE TYPE "CreatedByRole" AS ENUM ('ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PAID_NOW', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DUE', 'OVERDUE', 'PAID');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'FULFILLED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "IdSequenceKey" AS ENUM ('ORDER', 'VAT_ORDER', 'NON_VAT_ORDER');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "vat_order_id" TEXT,
    "non_vat_order_id" TEXT,
    "created_by_role" "CreatedByRole" NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_address" TEXT,
    "customer_type_snapshot" "OrderType" NOT NULL,
    "customer_vat_number_snapshot" TEXT,
    "order_type" "OrderType" NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_type" "PaymentType" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "payment_due_date" DATE,
    "paid_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "delete_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "kg_per_bag" DECIMAL(10,2) NOT NULL,
    "quantity_bags" DECIMAL(12,2) NOT NULL,
    "quantity_kg" DECIMAL(12,2) NOT NULL,
    "price_per_kg" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_sequences" (
    "id" UUID NOT NULL,
    "key" "IdSequenceKey" NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "id_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_vat_order_id_key" ON "orders"("vat_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_non_vat_order_id_key" ON "orders"("non_vat_order_id");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_fulfillment_status_idx" ON "orders"("fulfillment_status");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "id_sequences_key_key" ON "id_sequences"("key");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
