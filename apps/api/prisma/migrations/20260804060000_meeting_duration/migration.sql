ALTER TABLE "meetings"
ADD COLUMN "meeting_duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "meetings"
ADD CONSTRAINT "meetings_duration_supported"
CHECK ("meeting_duration_minutes" IN (30, 60, 90, 120));

ALTER TABLE "meetings"
ADD CONSTRAINT "meetings_duration_aligns_to_slot"
CHECK ("meeting_duration_minutes" % "slot_interval_minutes" = 0);
