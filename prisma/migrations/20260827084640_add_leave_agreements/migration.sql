-- CreateTable
CREATE TABLE "LeaveAgreement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leaveRequestId" INTEGER NOT NULL,
    "approverId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "agreedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveAgreement_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveAgreement_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "days" REAL NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT '연차',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LeaveRequest" ("createdAt", "days", "endDate", "id", "leaveType", "reason", "startDate", "status", "updatedAt", "userId") SELECT "createdAt", "days", "endDate", "id", "leaveType", "reason", "startDate", "status", "updatedAt", "userId" FROM "LeaveRequest";
DROP TABLE "LeaveRequest";
ALTER TABLE "new_LeaveRequest" RENAME TO "LeaveRequest";
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LeaveAgreement_leaveRequestId_idx" ON "LeaveAgreement"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveAgreement_approverId_idx" ON "LeaveAgreement"("approverId");

-- CreateIndex
CREATE INDEX "LeaveAgreement_status_idx" ON "LeaveAgreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveAgreement_leaveRequestId_approverId_key" ON "LeaveAgreement"("leaveRequestId", "approverId");
