-- AlterTable
ALTER TABLE "TopupTransaction" ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "cardType" TEXT,
ADD COLUMN     "responseCode" TEXT,
ADD COLUMN     "retrievalRef" TEXT,
ADD COLUMN     "stan" TEXT,
ADD COLUMN     "terminalId" TEXT,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "tokenExpiry" TEXT,
ADD COLUMN     "transactionId" TEXT;
