"use client";

import type {
  AvailabilitySlotDto,
  BestMatchDto,
  ParticipantSessionDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  MessageSquareText,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { InteractiveAvailabilityHeatmap } from "@/components/meetings/interactive-availability-heatmap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/auth-api";
import { useI18n } from "@/lib/i18n";
import { saveAvailability } from "@/lib/meeting-api";

interface AvailabilityGridProps {
  meeting: PublicMeetingDto;
  participantSession: ParticipantSessionDto;
  sessionToken?: string;
  token?: string;
  mode?: "organizer" | "participant";
  onSave?: (response: AvailabilityResponse) => Promise<unknown>;
  onSaved?: () => void | Promise<void>;
  saveScope?: string;
  manualMeetingMode?: boolean;
  onManualSelect?: (match: BestMatchDto) => void;
  selectedMatch?: BestMatchDto;
  highlightedMatch?: BestMatchDto;
  onInspectParticipants?: (participantIds: string[]) => void;
  showGuidanceOnMount?: boolean;
}

export interface AvailabilityResponse {
  slots: AvailabilitySlotDto[];
  comment?: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_IDLE_MS = 1_200;
const AUTOSAVE_MIN_INTERVAL_MS = 5_000;
const AUTOSAVE_ERROR_BACKOFF_MS = 10_000;

export function AvailabilityGrid({
  meeting,
  participantSession,
  sessionToken,
  token,
  mode = "participant",
  onSave,
  onSaved,
  saveScope,
  manualMeetingMode = false,
  onManualSelect,
  selectedMatch,
  highlightedMatch,
  onInspectParticipants,
  showGuidanceOnMount = mode === "participant",
}: AvailabilityGridProps) {
  const commentId = useId();
  const { t } = useI18n();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        participantSession.availabilities.map((slot) => slot.datetimeStart),
      ),
  );
  const [comment, setComment] = useState(participantSession.comment ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showGuidance, setShowGuidance] = useState(showGuidanceOnMount);
  const response = useMemo<AvailabilityResponse>(
    () => ({
      slots: meeting.slots
        .filter((slot) => selected.has(slot.datetimeStart))
        .map((slot) => ({
          datetimeStart: slot.datetimeStart,
          datetimeEnd: slot.datetimeEnd,
        })),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }),
    [comment, meeting.slots, selected],
  );
  const responseKey = useMemo(() => availabilityKey(response), [response]);
  const latestKey = useRef(responseKey);
  const lastSavedKey = useRef(responseKey);
  const lastSaveStartedAt = useRef(0);
  const autosaveBlockedUntil = useRef(0);
  const toggleSlot = useCallback((slotStart: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slotStart)) next.delete(slotStart);
      else next.add(slotStart);
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async (nextResponse: AvailabilityResponse) => {
      if (onSave) return onSave(nextResponse);
      if (!token || !sessionToken) {
        throw new Error("Availability session is missing.");
      }
      return saveAvailability(token, sessionToken, nextResponse);
    },
    scope: {
      id:
        saveScope ??
        `availability:${token}:${participantSession.participant.id}`,
    },
    onMutate: () => {
      lastSaveStartedAt.current = Date.now();
      setSaveState("saving");
    },
    onSuccess: async (_saved, variables) => {
      const savedKey = availabilityKey(variables);
      autosaveBlockedUntil.current = 0;
      lastSavedKey.current = savedKey;
      setSaveState(latestKey.current === savedKey ? "saved" : "dirty");
      await onSaved?.();
    },
    onError: (error) => {
      const retryAfter =
        error instanceof ApiError && error.status === 429
          ? (error.retryAfterMs ?? AUTOSAVE_ERROR_BACKOFF_MS)
          : AUTOSAVE_ERROR_BACKOFF_MS;
      autosaveBlockedUntil.current = Date.now() + retryAfter;
      setSaveState("error");
    },
  });
  const saveResponse = mutation.mutate;

  useEffect(() => {
    latestKey.current = responseKey;
  }, [responseKey]);

  useEffect(() => {
    if (!meeting.acceptingResponses || responseKey === lastSavedKey.current) {
      return;
    }
    setSaveState("dirty");
    if (mutation.isPending) return;

    const now = Date.now();
    const delay = Math.max(
      AUTOSAVE_IDLE_MS,
      AUTOSAVE_MIN_INTERVAL_MS - (now - lastSaveStartedAt.current),
      autosaveBlockedUntil.current - now,
    );
    const timeout = window.setTimeout(() => saveResponse(response), delay);
    return () => window.clearTimeout(timeout);
  }, [
    meeting.acceptingResponses,
    mutation.isPending,
    response,
    responseKey,
    saveResponse,
  ]);

  const error = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : t("Your availability could not be saved.")
    : undefined;

  if (meeting.dates.length === 0 || meeting.slots.length === 0) {
    return (
      <StatePanel
        className={mode === "participant" ? "mt-8" : undefined}
        description={t(
          "The organizer needs to add at least one valid day and time slot before availability can be selected.",
        )}
        title={t("No schedule slots yet")}
      />
    );
  }

  return (
    <section className={mode === "participant" ? "mt-8" : ""}>
      {mode === "participant" && (
        <ParticipantGuidanceDialog
          onOpenChange={setShowGuidance}
          open={showGuidance}
        />
      )}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {mode === "organizer" ? t("Your availability") : t("Responding as")}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {mode === "organizer"
              ? t("You (organizer)")
              : participantSession.participant.displayName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t(
              "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.",
            )}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-primary/65">
            <ClockBadge />{" "}
            {t(
              "Times are fixed to {timezone} (meeting timezone) · {minutes}-minute slots",
              {
                timezone: meeting.timezone,
                minutes: meeting.slotIntervalMinutes,
              },
            )}
          </p>
        </div>
        <div className="flex items-center">
          <SaveIndicator state={saveState} />
        </div>
      </div>

      {error && (
        <p
          className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <InteractiveAvailabilityHeatmap
          currentParticipant={participantSession.participant}
          editable={meeting.acceptingResponses}
          highlightedMatch={highlightedMatch}
          manualMeetingMode={manualMeetingMode}
          meeting={meeting}
          onInspectParticipants={onInspectParticipants}
          onManualSelect={onManualSelect}
          onToggleSlot={toggleSlot}
          participants={meeting.participants}
          selected={selected}
          selectedMatch={selectedMatch}
          showParticipantRoster={mode === "participant"}
        />
      </div>

      <div className="mt-5 space-y-2">
        <label
          className="flex items-center gap-2 text-sm font-medium"
          htmlFor={commentId}
        >
          <MessageSquareText className="size-4 text-primary" />{" "}
          {t("Optional note")}
        </label>
        <Textarea
          className="min-h-24"
          disabled={!meeting.acceptingResponses}
          id={commentId}
          maxLength={1000}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("For example: I can join 15 minutes late on Wednesday.")}
          value={comment}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("Your selections and note autosave after a short pause.")}</span>
          <span>{comment.length}/1000</span>
        </div>
      </div>
    </section>
  );
}

function ParticipantGuidanceDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("Your availability")}</DialogTitle>
          <DialogDescription>
            {t(
              "Tap or drag to mark the times that work for you. On phones, switch days with the navigator below.",
            )}
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Each hour is split into four 15-minute quarters.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Selected times are highlighted and saved automatically.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t(
              "Use the same name on another device to reopen this availability.",
            )}
          </li>
        </ul>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            {t("Continue to availability")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useI18n();
  const contents = {
    idle: { icon: <Cloud />, label: t("Autosave ready") },
    dirty: { icon: <Cloud />, label: t("Changes pending") },
    saving: {
      icon: <LoaderCircle className="animate-spin" />,
      label: t("Saving…"),
    },
    saved: { icon: <CheckCircle2 />, label: t("Saved") },
    error: { icon: <CloudOff />, label: t("Not saved") },
  }[state];
  return (
    <span
      aria-live="polite"
      className={`flex items-center gap-1.5 text-sm [&_svg]:size-4 ${
        state === "error" ? "text-red-300" : "text-primary"
      }`}
    >
      {contents.icon} {contents.label}
    </span>
  );
}

function ClockBadge() {
  return (
    <span className="grid size-4 place-items-center rounded-full border border-primary/30 bg-primary/10 text-[0.6rem] font-semibold text-primary">
      TZ
    </span>
  );
}

function availabilityKey(response: AvailabilityResponse) {
  return JSON.stringify({
    starts: response.slots.map((slot) => slot.datetimeStart),
    comment: response.comment ?? "",
  });
}
