-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "creditLimit" DECIMAL(12,2),
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 0;
