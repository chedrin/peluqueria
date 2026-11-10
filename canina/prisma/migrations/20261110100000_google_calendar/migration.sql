-- AlterEnum
ALTER TYPE "AppointmentSource" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncedVersion" INTEGER,
ADD COLUMN     "googleUpdated" TEXT;

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN     "googleEventId" TEXT;

-- CreateTable
CREATE TABLE "GoogleCalendarSync" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastStats" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_googleEventId_key" ON "Appointment"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlock_googleEventId_key" ON "TimeBlock"("googleEventId");

