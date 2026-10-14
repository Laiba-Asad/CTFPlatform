/*
  Warnings:

  - Added the required column `updatedAt` to the `Announcement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "releaseAt" DATETIME;

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "absoluteExpiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScoreAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" DATETIME,
    "reversedBy" TEXT,
    CONSTRAINT "ScoreAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "signupLocked" BOOLEAN NOT NULL DEFAULT false,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardFrozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeAt" DATETIME,
    "freezeMinutesBeforeEnd" INTEGER,
    "cooldownSeconds" INTEGER,
    "newPlayersPerIp" INTEGER,
    "maxPlayersPerTeam" INTEGER,
    "timezone" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Announcement" ("body", "createdAt", "id", "pinned", "title") SELECT "body", "createdAt", "id", "pinned", "title" FROM "Announcement";
DROP TABLE "Announcement";
ALTER TABLE "new_Announcement" RENAME TO "Announcement";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "status" TEXT NOT NULL DEFAULT 'active',
    "bannedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdIp" TEXT,
    "lastLoginAt" DATETIME,
    "lastSeenAt" DATETIME,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "createdIp", "id", "lastLoginAt", "name", "nameKey", "role", "teamId") SELECT "createdAt", "createdIp", "id", "lastLoginAt", "name", "nameKey", "role", "teamId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_nameKey_key" ON "User"("nameKey");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_username_key" ON "AdminAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_usernameKey_key" ON "AdminAccount"("usernameKey");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "ScoreAdjustment_userId_idx" ON "ScoreAdjustment"("userId");
