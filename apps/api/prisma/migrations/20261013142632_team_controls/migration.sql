-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "playerCap" INTEGER,
    "joinLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Team" ("avatar", "createdAt", "id", "name", "tagline") SELECT "avatar", "createdAt", "id", "name", "tagline" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
