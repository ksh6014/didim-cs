/*
  Warnings:

  - You are about to drop the `Test` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Test";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "area" TEXT,
    "address" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "installDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT '설치 예정',
    "equipment" TEXT,
    "memo" TEXT,
    "extraData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "siteId" INTEGER NOT NULL,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "userId" INTEGER,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteHistory_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "description" TEXT,
    "uploadedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteFile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SitePhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "uploadedById" INTEGER,
    "originalName" TEXT,
    "storedName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "caption" TEXT,
    "photoType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePhoto_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SitePhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Site_name_idx" ON "Site"("name");

-- CreateIndex
CREATE INDEX "Site_region_idx" ON "Site"("region");

-- CreateIndex
CREATE INDEX "Site_status_idx" ON "Site"("status");

-- CreateIndex
CREATE INDEX "Site_installDate_idx" ON "Site"("installDate");

-- CreateIndex
CREATE INDEX "UserSite_userId_idx" ON "UserSite"("userId");

-- CreateIndex
CREATE INDEX "UserSite_siteId_idx" ON "UserSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSite_userId_siteId_key" ON "UserSite"("userId", "siteId");

-- CreateIndex
CREATE INDEX "SiteHistory_siteId_idx" ON "SiteHistory"("siteId");

-- CreateIndex
CREATE INDEX "SiteHistory_userId_idx" ON "SiteHistory"("userId");

-- CreateIndex
CREATE INDEX "SiteHistory_createdAt_idx" ON "SiteHistory"("createdAt");

-- CreateIndex
CREATE INDEX "File_category_idx" ON "File"("category");

-- CreateIndex
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");

-- CreateIndex
CREATE INDEX "SiteFile_siteId_idx" ON "SiteFile"("siteId");

-- CreateIndex
CREATE INDEX "SiteFile_fileId_idx" ON "SiteFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteFile_siteId_fileId_key" ON "SiteFile"("siteId", "fileId");

-- CreateIndex
CREATE INDEX "SitePhoto_siteId_idx" ON "SitePhoto"("siteId");

-- CreateIndex
CREATE INDEX "SitePhoto_uploadedById_idx" ON "SitePhoto"("uploadedById");

-- CreateIndex
CREATE INDEX "SitePhoto_createdAt_idx" ON "SitePhoto"("createdAt");

-- CreateIndex
CREATE INDEX "Notice_authorId_idx" ON "Notice"("authorId");

-- CreateIndex
CREATE INDEX "Notice_createdAt_idx" ON "Notice"("createdAt");

-- CreateIndex
CREATE INDEX "Notice_isPinned_idx" ON "Notice"("isPinned");
