-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "name" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "override" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "flagHash" TEXT NOT NULL,
    "flagSalt" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockAfterId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Challenge_unlockAfterId_fkey" FOREIGN KEY ("unlockAfterId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Hint_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HintUnlock" (
    "userId" TEXT NOT NULL,
    "hintId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "hintId"),
    CONSTRAINT "HintUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HintUnlock_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "Hint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    CONSTRAINT "Attachment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Solve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "firstBlood" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Solve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Solve_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "achievementId"),
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_nameKey_key" ON "User"("nameKey");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_number_key" ON "Challenge"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_challengeId_order_key" ON "Hint"("challengeId", "order");

-- CreateIndex
CREATE INDEX "Attachment_challengeId_idx" ON "Attachment"("challengeId");

-- CreateIndex
CREATE INDEX "Submission_userId_challengeId_idx" ON "Submission"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- CreateIndex
CREATE INDEX "Solve_challengeId_idx" ON "Solve"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "Solve_userId_challengeId_key" ON "Solve"("userId", "challengeId");
