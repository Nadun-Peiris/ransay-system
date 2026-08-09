/*
  Warnings:

  - Made the column `order_id` on table `order_items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "order_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "order_id" DROP NOT NULL;
