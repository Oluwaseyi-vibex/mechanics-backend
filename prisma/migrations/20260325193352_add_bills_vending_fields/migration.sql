-- AlterTable
ALTER TABLE "TopupTransaction" ADD COLUMN     "vendRequestRef" TEXT,
ADD COLUMN     "vendResponseCode" TEXT,
ADD COLUMN     "vendResponseMessage" TEXT,
ADD COLUMN     "vendToken" TEXT,
ADD COLUMN     "vendUnits" TEXT;
