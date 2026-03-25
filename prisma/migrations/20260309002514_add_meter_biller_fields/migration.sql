-- DropForeignKey
ALTER TABLE "Meter" DROP CONSTRAINT "Meter_userId_fkey";

-- AlterTable
ALTER TABLE "Meter" ADD COLUMN     "billerCode" TEXT NOT NULL DEFAULT '905',
ADD COLUMN     "paymentCode" TEXT NOT NULL DEFAULT '90501';

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
