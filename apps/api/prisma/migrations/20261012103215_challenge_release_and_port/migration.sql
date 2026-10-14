-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "flagHash" TEXT NOT NULL,
    "flagSalt" TEXT NOT NULL,
    "port" INTEGER,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockAfterId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Challenge_unlockAfterId_fkey" FOREIGN KEY ("unlockAfterId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Challenge" ("category", "createdAt", "description", "difficulty", "flagHash", "flagSalt", "id", "isLocked", "number", "points", "title", "unlockAfterId", "updatedAt", "visible") SELECT "category", "createdAt", "description", "difficulty", "flagHash", "flagSalt", "id", "isLocked", "number", "points", "title", "unlockAfterId", "updatedAt", "visible" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
CREATE UNIQUE INDEX "Challenge_number_key" ON "Challenge"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
