-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "color" TEXT,
ADD COLUMN     "hsnCode" TEXT DEFAULT '8517',
ADD COLUMN     "modelKey" TEXT,
ADD COLUMN     "trackSerial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variant" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "amountInWords" TEXT,
ADD COLUMN     "cgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customerAadhaar" TEXT,
ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerGstin" TEXT,
ADD COLUMN     "customerState" TEXT,
ADD COLUMN     "customerStateCode" TEXT,
ADD COLUMN     "igstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "placeOfSupply" TEXT,
ADD COLUMN     "roundOff" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "cgstAmount" DECIMAL(12,2),
ADD COLUMN     "chargerNoSnapshot" TEXT,
ADD COLUMN     "colorSnapshot" TEXT,
ADD COLUMN     "hsnSnapshot" TEXT,
ADD COLUMN     "igstAmount" DECIMAL(12,2),
ADD COLUMN     "imei2Snapshot" TEXT,
ADD COLUMN     "imeiSnapshot" TEXT,
ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(12,2),
ADD COLUMN     "stockUnitId" TEXT,
ADD COLUMN     "taxableValue" DECIMAL(12,2),
ADD COLUMN     "unitBasePrice" DECIMAL(12,2),
ADD COLUMN     "variantSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "brandsServiced" JSONB,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "state" TEXT DEFAULT 'Jharkhand',
ADD COLUMN     "stateCode" TEXT DEFAULT '20',
ADD COLUMN     "tagline" TEXT DEFAULT 'Mobile Sale & Service — All Types of Mobile Repairing here',
ADD COLUMN     "termsAndConditions" TEXT,
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "warrantyNote" TEXT DEFAULT 'All warranty & guaranty by Manufacturer';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "stockUnitId" TEXT;

-- CreateTable
CREATE TABLE "StockUnit" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imei1" TEXT NOT NULL,
    "imei2" TEXT,
    "serialNumber" TEXT,
    "chargerNo" TEXT,
    "purchaseCost" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" TEXT,
    "purchaseRef" TEXT,
    "soldAt" TIMESTAMP(3),
    "saleItemId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockUnit_saleItemId_key" ON "StockUnit"("saleItemId");

-- CreateIndex
CREATE INDEX "StockUnit_shopId_productId_status_idx" ON "StockUnit"("shopId", "productId", "status");

-- CreateIndex
CREATE INDEX "StockUnit_imei2_idx" ON "StockUnit"("imei2");

-- CreateIndex
CREATE UNIQUE INDEX "StockUnit_shopId_imei1_key" ON "StockUnit"("shopId", "imei1");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_modelKey_key" ON "Product"("shopId", "modelKey");

-- CreateIndex
CREATE INDEX "SaleItem_stockUnitId_idx" ON "SaleItem"("stockUnitId");

-- CreateIndex
CREATE INDEX "StockMovement_stockUnitId_idx" ON "StockMovement"("stockUnitId");

-- AddForeignKey
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "StockUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

