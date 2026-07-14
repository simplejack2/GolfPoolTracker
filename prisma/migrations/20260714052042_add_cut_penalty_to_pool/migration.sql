-- CreateEnum
CREATE TYPE "CutPenaltyMode" AS ENUM ('DROP', 'FIXED');

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "cutPenaltyMode" "CutPenaltyMode" NOT NULL DEFAULT 'DROP',
ADD COLUMN     "cutPenaltyValue" INTEGER;
