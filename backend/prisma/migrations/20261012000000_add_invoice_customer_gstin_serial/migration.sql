-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "gstin" TEXT;
