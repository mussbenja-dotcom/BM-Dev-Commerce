ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "Order_storeId_checkoutKey_key" ON "Order"("storeId", "checkoutKey");
