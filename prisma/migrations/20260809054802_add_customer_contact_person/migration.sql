-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contact_person" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_contact_person" TEXT;
