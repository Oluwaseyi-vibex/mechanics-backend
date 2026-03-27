-- AlterTable
ALTER TABLE "Meter" ADD COLUMN     "currentCredit" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authData" TEXT,
ADD COLUMN     "topupAmount" DECIMAL(65,30) DEFAULT 0;
