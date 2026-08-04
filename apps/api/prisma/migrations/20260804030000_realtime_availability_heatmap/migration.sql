ALTER TABLE "meetings"
ADD COLUMN "slot_interval_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "participants"
ADD COLUMN "comment" TEXT,
ADD COLUMN "responded_at" TIMESTAMP(3);
