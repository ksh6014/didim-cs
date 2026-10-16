-- CreateTable
CREATE TABLE "SiteAsset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "installedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT '사용중',
    "location" TEXT,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '파일',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceFile_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "userId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceActivity_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL DEFAULT 'SERVICE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "checkedById" INTEGER,
    "checkedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceChecklistItem_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceChecklistItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "checkedById" INTEGER,
    "checkedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteChecklistItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteChecklistItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
INSERT INTO "new_ServiceRequest" ("billingAmount", "billingType", "contact", "createdAt", "createdById", "id", "memo", "receivedDate", "requestContent", "resolution", "siteId", "status", "updatedAt", "visitDate") SELECT "billingAmount", "billingType", "contact", "createdAt", "createdById", "id", "memo", "receivedDate", "requestContent", "resolution", "siteId", "status", "updatedAt", "visitDate" FROM "ServiceRequest";
DROP TABLE "ServiceRequest";
ALTER TABLE "new_ServiceRequest" RENAME TO "ServiceRequest";
CREATE UNIQUE INDEX "ServiceRequest_workLogId_key" ON "ServiceRequest"("workLogId");
CREATE INDEX "ServiceRequest_siteId_idx" ON "ServiceRequest"("siteId");
CREATE INDEX "ServiceRequest_createdById_idx" ON "ServiceRequest"("createdById");
CREATE INDEX "ServiceRequest_receivedDate_idx" ON "ServiceRequest"("receivedDate");
CREATE INDEX "ServiceRequest_visitDate_idx" ON "ServiceRequest"("visitDate");
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");
CREATE INDEX "ServiceRequest_billingType_idx" ON "ServiceRequest"("billingType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SiteAsset_assetCode_key" ON "SiteAsset"("assetCode");

-- CreateIndex
CREATE INDEX "SiteAsset_siteId_idx" ON "SiteAsset"("siteId");

-- CreateIndex
CREATE INDEX "SiteAsset_assetType_idx" ON "SiteAsset"("assetType");

-- CreateIndex
CREATE INDEX "SiteAsset_status_idx" ON "SiteAsset"("status");

-- CreateIndex
CREATE INDEX "SiteAsset_installedAt_idx" ON "SiteAsset"("installedAt");

-- CreateIndex
CREATE INDEX "ServiceFile_serviceRequestId_idx" ON "ServiceFile"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceFile_fileId_idx" ON "ServiceFile"("fileId");

-- CreateIndex
CREATE INDEX "ServiceFile_kind_idx" ON "ServiceFile"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFile_serviceRequestId_fileId_key" ON "ServiceFile"("serviceRequestId", "fileId");

-- CreateIndex
CREATE INDEX "ServiceActivity_serviceRequestId_idx" ON "ServiceActivity"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceActivity_userId_idx" ON "ServiceActivity"("userId");

-- CreateIndex
CREATE INDEX "ServiceActivity_type_idx" ON "ServiceActivity"("type");

-- CreateIndex
CREATE INDEX "ServiceActivity_createdAt_idx" ON "ServiceActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_workType_idx" ON "ChecklistTemplate"("workType");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_isActive_idx" ON "ChecklistTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_createdById_idx" ON "ChecklistTemplate"("createdById");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_sortOrder_idx" ON "ChecklistTemplateItem"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceChecklistItem_serviceRequestId_idx" ON "ServiceChecklistItem"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceChecklistItem_checked_idx" ON "ServiceChecklistItem"("checked");

-- CreateIndex
CREATE INDEX "ServiceChecklistItem_sortOrder_idx" ON "ServiceChecklistItem"("sortOrder");

-- CreateIndex
CREATE INDEX "SiteChecklistItem_siteId_idx" ON "SiteChecklistItem"("siteId");

-- CreateIndex
CREATE INDEX "SiteChecklistItem_checked_idx" ON "SiteChecklistItem"("checked");

-- CreateIndex
CREATE INDEX "SiteChecklistItem_sortOrder_idx" ON "SiteChecklistItem"("sortOrder");
