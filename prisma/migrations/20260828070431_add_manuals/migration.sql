-- CreateTable
CREATE TABLE "Manual" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "category" TEXT NOT NULL DEFAULT '기타',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceCandidateId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Manual_sourceCandidateId_fkey" FOREIGN KEY ("sourceCandidateId") REFERENCES "ManualCandidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Manual_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Manual_sourceCandidateId_key" ON "Manual"("sourceCandidateId");

-- CreateIndex
CREATE INDEX "Manual_category_idx" ON "Manual"("category");

-- CreateIndex
CREATE INDEX "Manual_status_idx" ON "Manual"("status");

-- CreateIndex
CREATE INDEX "Manual_createdById_idx" ON "Manual"("createdById");

-- CreateIndex
CREATE INDEX "Manual_createdAt_idx" ON "Manual"("createdAt");
