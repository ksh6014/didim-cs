-- CreateTable
CREATE TABLE "ServiceRequest" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceAssignee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAssignee_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ServiceRequest_siteId_idx" ON "ServiceRequest"("siteId");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdById_idx" ON "ServiceRequest"("createdById");

-- CreateIndex
CREATE INDEX "ServiceRequest_receivedDate_idx" ON "ServiceRequest"("receivedDate");

-- CreateIndex
CREATE INDEX "ServiceRequest_visitDate_idx" ON "ServiceRequest"("visitDate");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_billingType_idx" ON "ServiceRequest"("billingType");

-- CreateIndex
CREATE INDEX "ServiceAssignee_serviceRequestId_idx" ON "ServiceAssignee"("serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceAssignee_userId_idx" ON "ServiceAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAssignee_serviceRequestId_userId_key" ON "ServiceAssignee"("serviceRequestId", "userId");
