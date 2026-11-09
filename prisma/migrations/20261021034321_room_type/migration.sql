-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "facilities" TEXT NOT NULL DEFAULT '[]',
    "roomType" TEXT NOT NULL DEFAULT 'serbaguna',
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "cancellationDeadlineMinutes" INTEGER NOT NULL DEFAULT 0,
    "attachmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Room" ("active", "attachmentRequired", "building", "cancellationDeadlineMinutes", "capacity", "closeTime", "createdAt", "facilities", "floor", "id", "maxDurationMinutes", "name", "openTime", "requiresApproval", "updatedAt") SELECT "active", "attachmentRequired", "building", "cancellationDeadlineMinutes", "capacity", "closeTime", "createdAt", "facilities", "floor", "id", "maxDurationMinutes", "name", "openTime", "requiresApproval", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_name_building_floor_key" ON "Room"("name", "building", "floor");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
