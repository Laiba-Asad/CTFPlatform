-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannedReason" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "releaseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,

    CONSTRAINT "ScoreAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "signupLocked" BOOLEAN NOT NULL DEFAULT false,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardFrozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeAt" TIMESTAMP(3),
    "freezeMinutesBeforeEnd" INTEGER,
    "cooldownSeconds" INTEGER,
    "newPlayersPerIp" INTEGER,
    "maxPlayersPerTeam" INTEGER,
    "timezone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAdjustment" ADD CONSTRAINT "ScoreAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

