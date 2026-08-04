-- Supporting indexes for bounded organizer lists, response aggregation,
-- meeting detail ordering, availability lookup, and token cleanup.
CREATE INDEX "refresh_tokens_expires_at_idx"
  ON "refresh_tokens"("expires_at");

CREATE INDEX "meetings_organizer_id_created_at_id_idx"
  ON "meetings"("organizer_id", "created_at", "id");

CREATE INDEX "participants_meeting_id_joined_at_idx"
  ON "participants"("meeting_id", "joined_at");

CREATE INDEX "participants_meeting_id_responded_at_idx"
  ON "participants"("meeting_id", "responded_at");

CREATE INDEX "availabilities_participant_id_datetime_start_idx"
  ON "availabilities"("participant_id", "datetime_start");
