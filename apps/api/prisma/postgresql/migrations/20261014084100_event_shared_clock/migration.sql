-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "pausedRemainingMs" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'waiting';

