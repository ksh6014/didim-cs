-- CreateTable
CREATE TABLE "SystemOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupKey" TEXT NOT NULL,
    "groupLabel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SystemOption_groupKey_idx" ON "SystemOption"("groupKey");

-- CreateIndex
CREATE INDEX "SystemOption_isActive_idx" ON "SystemOption"("isActive");

-- CreateIndex
CREATE INDEX "SystemOption_sortOrder_idx" ON "SystemOption"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SystemOption_groupKey_value_key" ON "SystemOption"("groupKey", "value");
