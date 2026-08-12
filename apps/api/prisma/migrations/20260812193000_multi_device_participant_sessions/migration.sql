CREATE TABLE "participant_sessions" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "participant_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "participant_sessions_token_hash_key"
ON "participant_sessions"("token_hash");

CREATE INDEX "participant_sessions_participant_id_idx"
ON "participant_sessions"("participant_id");

ALTER TABLE "participant_sessions"
ADD CONSTRAINT "participant_sessions_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "participants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing browser session while moving to one-session-per-device rows.
INSERT INTO "participant_sessions" ("id", "participant_id", "token_hash", "created_at")
SELECT 'legacy_' || "id", "id", "session_token_hash", "joined_at"
FROM "participants"
WHERE "session_token_hash" IS NOT NULL
ON CONFLICT ("token_hash") DO NOTHING;
