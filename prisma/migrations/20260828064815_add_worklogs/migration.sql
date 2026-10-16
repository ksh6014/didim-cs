-- CreateTable
CREATE TABLE "WorkLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorId" INTEGER NOT NULL,
    "workDate" DATETIME NOT NULL,
    "title" TEXT,
    "completedWork" TEXT,
    "pendingWork" TEXT,
    "nextPlan" TEXT,
    "issues" TEXT,
    "handover" TEXT,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "extraData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLogSite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workLogId" INTEGER NOT NULL,
    "siteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLogSite_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLogSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLogFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workLogId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLogFile_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLogFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLogComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workLogId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkLogComment_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLogComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualCandidate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workLogId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualCandidate_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkLog_authorId_idx" ON "WorkLog"("authorId");

-- CreateIndex
CREATE INDEX "WorkLog_workDate_idx" ON "WorkLog"("workDate");

-- CreateIndex
CREATE INDEX "WorkLog_status_idx" ON "WorkLog"("status");

-- CreateIndex
CREATE INDEX "WorkLog_createdAt_idx" ON "WorkLog"("createdAt");

-- CreateIndex
CREATE INDEX "WorkLogSite_workLogId_idx" ON "WorkLogSite"("workLogId");

-- CreateIndex
CREATE INDEX "WorkLogSite_siteId_idx" ON "WorkLogSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogSite_workLogId_siteId_key" ON "WorkLogSite"("workLogId", "siteId");

-- CreateIndex
CREATE INDEX "WorkLogFile_workLogId_idx" ON "WorkLogFile"("workLogId");

-- CreateIndex
CREATE INDEX "WorkLogFile_fileId_idx" ON "WorkLogFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogFile_workLogId_fileId_key" ON "WorkLogFile"("workLogId", "fileId");

-- CreateIndex
CREATE INDEX "WorkLogComment_workLogId_idx" ON "WorkLogComment"("workLogId");

-- CreateIndex
CREATE INDEX "WorkLogComment_authorId_idx" ON "WorkLogComment"("authorId");

-- CreateIndex
CREATE INDEX "WorkLogComment_createdAt_idx" ON "WorkLogComment"("createdAt");

-- CreateIndex
CREATE INDEX "ManualCandidate_workLogId_idx" ON "ManualCandidate"("workLogId");

-- CreateIndex
CREATE INDEX "ManualCandidate_status_idx" ON "ManualCandidate"("status");
