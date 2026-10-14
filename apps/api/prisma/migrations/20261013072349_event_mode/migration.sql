/*
  Warnings:

  - You are about to drop the column `override` on the `Event` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "name" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'scheduled',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("endsAt", "id", "name", "startsAt", "updatedAt") SELECT "endsAt", "id", "name", "startsAt", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
