"use client";

import type {
  AvailabilitySlotDto,
  ParticipantSessionDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  MessageSquareText,
  Save,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
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
  saveScope?: string;
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
  saveScope,
}: AvailabilityGridProps) {
  const commentId = useId();
  const toast = useToast();
  const { formatDate, t } = useI18n();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        participantSession.availabilities.map((slot) => slot.datetimeStart),
      ),
  );
  const [comment, setComment] = useState(participantSession.comment ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dragging = useRef(false);
  const touchedSlot = useRef<string | undefined>(undefined);
  const touchGesture = useRef<
    | {
        pointerId: number;
        startX: number;
        startY: number;
        slotStart: string;
        dragging: boolean;
      }
    | undefined
  >(undefined);
  const hours = useMemo(
    () =>
      Array.from(
        new Set(
          meeting.slots.map((slot) => `${slot.timeLabel.slice(0, 2)}:00`),
        ),
      ),
    [meeting.slots],
  );
  const slotByCell = useMemo(
    () =>
      new Map(
        meeting.slots.map((slot) => [`${slot.date}:${slot.timeLabel}`, slot]),
      ),
    [meeting.slots],
  );
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
    onSuccess: (_saved, variables) => {
      const savedKey = availabilityKey(variables);
      autosaveBlockedUntil.current = 0;
      lastSavedKey.current = savedKey;
      setSaveState(latestKey.current === savedKey ? "saved" : "dirty");
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
    function finishDrag(event: globalThis.PointerEvent) {
      const touch = touchGesture.current;
      if (
        touch &&
        touch.pointerId === event.pointerId &&
        !touch.dragging &&
        Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY) <
          8
      ) {
        toggleSlot(touch.slotStart);
      }
      touchGesture.current = undefined;
      dragging.current = false;
      touchedSlot.current = undefined;
    }
    function cancelDrag() {
      touchGesture.current = undefined;
      dragging.current = false;
      touchedSlot.current = undefined;
    }
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [toggleSlot]);

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

  function applySlot(slotStart: string) {
    if (!dragging.current || touchedSlot.current === slotStart) return;
    touchedSlot.current = slotStart;
    toggleSlot(slotStart);
  }

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    slotStart: string,
  ) {
    if (!meeting.acceptingResponses || event.button !== 0) return;
    if (event.pointerType === "touch") {
      touchGesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        slotStart,
        dragging: false,
      };
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    touchedSlot.current = undefined;
    applySlot(slotStart);
  }

  function continueDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const touch = touchGesture.current;
    if (touch && touch.pointerId === event.pointerId) {
      const deltaX = event.clientX - touch.startX;
      const deltaY = event.clientY - touch.startY;
      if (!touch.dragging) {
        if (Math.abs(deltaY) >= Math.abs(deltaX) || Math.abs(deltaX) < 8) {
          return;
        }
        touch.dragging = true;
        dragging.current = true;
        touchedSlot.current = undefined;
        applySlot(touch.slotStart);
      }
      event.preventDefault();
    }
    if (!dragging.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const slot = element?.closest<HTMLElement>("[data-slot-start]");
    if (slot?.dataset.slotStart) applySlot(slot.dataset.slotStart);
  }

  function toggleFromKeyboard(slotStart: string) {
    toggleSlot(slotStart);
  }

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
              "Tap one square or paint across several. The complete timetable is always shown below.",
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
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button
            disabled={!meeting.acceptingResponses || mutation.isPending}
            onClick={() =>
              saveResponse(response, {
                onSuccess: () =>
                  toast({
                    title: t("Availability saved"),
                    description: t("Your latest times and note are safely stored."),
                    variant: "success",
                  }),
              })
            }
            type="button"
          >
            {saveState === "saving" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Save />
            )}
            {t("Save now")}
          </Button>
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

      <div className="mt-6 w-full">
        <div
          className="grid w-full min-w-0 select-none"
          onPointerMove={continueDrag}
          style={{
            gridTemplateColumns: `4.25rem repeat(${meeting.dates.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {meeting.dates.map((date) => (
            <div
              className="min-w-0 truncate px-1 py-3 text-center text-[0.68rem] font-medium leading-tight text-muted-foreground sm:text-xs"
              key={date.date}
              title={date.label}
            >
              {formatDate(date.date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          ))}

          {hours.map((hour) => (
            <GridRow
              dates={meeting.dates}
              formatDate={formatDate}
              key={hour}
              meetingOpen={meeting.acceptingResponses}
              onKeyboardToggle={toggleFromKeyboard}
              onPointerDown={startDrag}
              selected={selected}
              slotByCell={slotByCell}
              hour={hour}
              t={t}
            />
          ))}
        </div>
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

function GridRow({
  dates,
  formatDate,
  hour,
  meetingOpen,
  onKeyboardToggle,
  onPointerDown,
  selected,
  slotByCell,
  t,
}: {
  dates: PublicMeetingDto["dates"];
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  hour: string;
  meetingOpen: boolean;
  onKeyboardToggle: (slotStart: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    slotStart: string,
  ) => void;
  selected: Set<string>;
  slotByCell: Map<string, PublicMeetingDto["slots"][number]>;
  t: (message: string, variables?: Record<string, string | number>) => string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="px-2 py-5 text-xs text-muted-foreground">{hour}</div>
      {dates.map((date) => (
        <div className="min-h-14 p-1" key={date.date}>
          <div className="grid size-full min-h-11 grid-cols-4 overflow-hidden rounded-xl border border-white/10">
            {[0, 15, 30, 45].map((quarter) => {
              const time = `${hour.slice(0, 3)}${String(quarter).padStart(2, "0")}`;
              const slot = slotByCell.get(`${date.date}:${time}`);
              if (!slot) {
                return (
                  <span
                    aria-hidden="true"
                    className="bg-white/[0.01]"
                    key={quarter}
                  />
                );
              }
              const active = selected.has(slot.datetimeStart);
              const dateLabel = formatDate(date.date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <motion.button
                  aria-label={t(
                    active ? "Remove {date} at {time}" : "Select {date} at {time}",
                    { date: dateLabel, time },
                  )}
                  aria-pressed={active}
                  className={`relative min-h-11 touch-pan-y transition duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary ${
                    active
                      ? "bg-primary/75 shadow-[0_0_18px_-8px_oklch(0.82_0.18_245_/_0.85)] hover:bg-primary/85"
                      : "bg-white/[0.015] hover:bg-white/[0.07]"
                  }`}
                  data-slot-start={slot.datetimeStart}
                  disabled={!meetingOpen}
                  key={quarter}
                  onClick={(event) => {
                    if (event.detail === 0)
                      onKeyboardToggle(slot.datetimeStart);
                  }}
                  onPointerDown={(event) =>
                    onPointerDown(event, slot.datetimeStart)
                  }
                  title={time}
                  type="button"
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
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
