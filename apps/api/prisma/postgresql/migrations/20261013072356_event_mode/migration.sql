-- AlterTable
ALTER TABLE "Event" DROP COLUMN "override",
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'scheduled';

