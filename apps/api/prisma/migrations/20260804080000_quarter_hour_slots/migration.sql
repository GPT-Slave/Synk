-- Every timetable uses quarter-hour cells. Expand legacy 30/60-minute
-- availability rows before changing the meeting grid so existing responses
-- remain visually and semantically equivalent.
INSERT INTO "availabilities" (
  "id",
  "participant_id",
  "datetime_start",
  "datetime_end"
)
SELECT
  CONCAT("availability"."id", '_q', "quarter"."ordinality"),
  "availability"."participant_id",
  "quarter"."datetime_start",
  "quarter"."datetime_start" + INTERVAL '15 minutes'
FROM "availabilities" AS "availability"
CROSS JOIN LATERAL generate_series(
  "availability"."datetime_start",
  "availability"."datetime_end" - INTERVAL '15 minutes',
  INTERVAL '15 minutes'
) WITH ORDINALITY AS "quarter"("datetime_start", "ordinality")
WHERE "availability"."datetime_end" - "availability"."datetime_start"
  > INTERVAL '15 minutes'
ON CONFLICT DO NOTHING;

DELETE FROM "availabilities"
WHERE "datetime_end" - "datetime_start" <> INTERVAL '15 minutes';

UPDATE "meetings"
SET "slot_interval_minutes" = 15
WHERE "slot_interval_minutes" <> 15;

ALTER TABLE "meetings"
ALTER COLUMN "slot_interval_minutes" SET DEFAULT 15;

ALTER TABLE "meetings"
ADD CONSTRAINT "meetings_quarter_hour_slots"
CHECK ("slot_interval_minutes" = 15);
