ALTER TABLE "meetings"
ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "final_slot_end" TIMESTAMP(3);

ALTER TABLE "participants"
ALTER COLUMN "session_token_hash" DROP NOT NULL,
ADD COLUMN "organizer_id" TEXT;

CREATE UNIQUE INDEX "uniq_meeting_organizer_response"
ON "participants"("meeting_id", "organizer_id");

ALTER TABLE "participants"
ADD CONSTRAINT "participants_organizer_id_fkey"
FOREIGN KEY ("organizer_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
