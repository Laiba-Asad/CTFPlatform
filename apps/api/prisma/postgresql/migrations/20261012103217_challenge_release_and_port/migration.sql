-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "port" INTEGER,
ADD COLUMN     "released" BOOLEAN NOT NULL DEFAULT false;

