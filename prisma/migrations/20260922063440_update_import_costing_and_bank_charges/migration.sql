-- AlterTable
ALTER TABLE "import_items" ADD COLUMN     "bank_processing_charges_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "import_shipments" ADD COLUMN     "total_bank_processing_charges_lkr" DECIMAL(14,2) NOT NULL DEFAULT 0;
