-- Players no longer see a difficulty level, and the visible mission number is
-- derived from board order (points, then id). Both columns are dropped; no
-- other data changes.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "flagHash" TEXT NOT NULL,
    "flagSalt" TEXT NOT NULL,
    "port" INTEGER,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "releaseAt" DATETIME,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockAfterId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Challenge_unlockAfterId_fkey" FOREIGN KEY ("unlockAfterId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Challenge" ("category", "createdAt", "description", "flagHash", "flagSalt", "id", "isLocked", "points", "port", "releaseAt", "released", "title", "unlockAfterId", "updatedAt", "visible") SELECT "category", "createdAt", "description", "flagHash", "flagSalt", "id", "isLocked", "points", "port", "releaseAt", "released", "title", "unlockAfterId", "updatedAt", "visible" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

