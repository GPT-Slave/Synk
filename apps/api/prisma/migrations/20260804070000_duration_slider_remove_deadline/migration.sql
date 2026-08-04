ALTER TABLE "meetings"
DROP CONSTRAINT "meetings_duration_supported";

ALTER TABLE "meetings"
ADD CONSTRAINT "meetings_duration_supported"
CHECK (
  "meeting_duration_minutes" BETWEEN 15 AND 360
  AND "meeting_duration_minutes" % 15 = 0
);

ALTER TABLE "meetings"
DROP COLUMN "response_deadline";
