-- CreateTable
CREATE TABLE "SystemOptionGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemOptionGroup_key_key" ON "SystemOptionGroup"("key");

-- CreateIndex
CREATE INDEX "SystemOptionGroup_isActive_idx" ON "SystemOptionGroup"("isActive");

-- CreateIndex
CREATE INDEX "SystemOptionGroup_sortOrder_idx" ON "SystemOptionGroup"("sortOrder");
