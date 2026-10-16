-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServiceRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "receivedDate" DATETIME NOT NULL,
    "visitDate" DATETIME,
    "requestContent" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT '방문A/S',
    "intakeChannel" TEXT NOT NULL DEFAULT '전화',
    "customerName" TEXT,
    "priority" TEXT NOT NULL DEFAULT '일반',
    "resolution" TEXT,
    "contact" TEXT,
    "billingType" TEXT NOT NULL DEFAULT '무상',
    "billingAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '접수',
    "memo" TEXT,
    "completedAt" DATETIME,
    "workLogId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceRequest" ("billingAmount", "billingType", "completedAt", "contact", "createdAt", "createdById", "id", "memo", "receivedDate", "requestContent", "resolution", "siteId", "status", "updatedAt", "visitDate", "workLogId") SELECT "billingAmount", "billingType", "completedAt", "contact", "createdAt", "createdById", "id", "memo", "receivedDate", "requestContent", "resolution", "siteId", "status", "updatedAt", "visitDate", "workLogId" FROM "ServiceRequest";
DROP TABLE "ServiceRequest";
ALTER TABLE "new_ServiceRequest" RENAME TO "ServiceRequest";
CREATE UNIQUE INDEX "ServiceRequest_workLogId_key" ON "ServiceRequest"("workLogId");
CREATE INDEX "ServiceRequest_siteId_idx" ON "ServiceRequest"("siteId");
CREATE INDEX "ServiceRequest_createdById_idx" ON "ServiceRequest"("createdById");
CREATE INDEX "ServiceRequest_receivedDate_idx" ON "ServiceRequest"("receivedDate");
CREATE INDEX "ServiceRequest_visitDate_idx" ON "ServiceRequest"("visitDate");
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");
CREATE INDEX "ServiceRequest_billingType_idx" ON "ServiceRequest"("billingType");
CREATE INDEX "ServiceRequest_requestType_idx" ON "ServiceRequest"("requestType");
CREATE INDEX "ServiceRequest_intakeChannel_idx" ON "ServiceRequest"("intakeChannel");
CREATE INDEX "ServiceRequest_priority_idx" ON "ServiceRequest"("priority");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
