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
  const times = useMemo(
    () => Array.from(new Set(meeting.slots.map((slot) => slot.timeLabel))),
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
    onMutate: () => setSaveState("saving"),
    onSuccess: (_saved, variables) => {
      const savedKey = availabilityKey(variables);
      lastSavedKey.current = savedKey;
      setSaveState(latestKey.current === savedKey ? "saved" : "dirty");
    },
    onError: () => setSaveState("error"),
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
    const timeout = window.setTimeout(() => saveResponse(response), 700);
    return () => window.clearTimeout(timeout);
  }, [meeting.acceptingResponses, response, responseKey, saveResponse]);

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
      : "Your availability could not be saved."
    : undefined;

  if (meeting.dates.length === 0 || meeting.slots.length === 0) {
    return (
      <StatePanel
        className={mode === "participant" ? "mt-8" : undefined}
        description="The organizer needs to add at least one valid day and time slot before availability can be selected."
        title="No schedule slots yet"
      />
    );
  }

  return (
    <section className={mode === "participant" ? "mt-8" : ""}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {mode === "organizer" ? "Your availability" : "Responding as"}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {participantSession.participant.displayName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tap one square or paint across several. Drag sideways to see more
            days on smaller screens.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-primary/65">
            <ClockBadge /> Times are fixed to {meeting.timezone} (meeting
            timezone) · {meeting.slotIntervalMinutes}-minute slots
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={saveState} />
          <Button
            disabled={!meeting.acceptingResponses}
            onClick={() =>
              saveResponse(response, {
                onSuccess: () =>
                  toast({
                    title: "Availability saved",
                    description:
                      "Your latest times and note are safely stored.",
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
            Save now
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

      <div className="schedule-scroll mt-6 max-h-[68svh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] overscroll-x-contain overscroll-y-auto">
        <div
          className="grid min-w-max select-none"
          onPointerMove={continueDrag}
          style={{
            gridTemplateColumns: `4.75rem repeat(${meeting.dates.length}, minmax(8.5rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 border-b border-r border-white/10 bg-card/95 backdrop-blur-xl" />
          {meeting.dates.map((date) => (
            <div
              className="sticky top-0 z-20 border-b border-r border-white/10 bg-card/95 px-3 py-3 text-center text-xs font-medium backdrop-blur-xl last:border-r-0"
              key={date.date}
            >
              {date.label}
            </div>
          ))}

          {times.map((time) => (
            <GridRow
              dates={meeting.dates}
              key={time}
              meetingOpen={meeting.acceptingResponses}
              onKeyboardToggle={toggleFromKeyboard}
              onPointerDown={startDrag}
              selected={selected}
              slotByCell={slotByCell}
              time={time}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <label
          className="flex items-center gap-2 text-sm font-medium"
          htmlFor={commentId}
        >
          <MessageSquareText className="size-4 text-primary" /> Optional note
        </label>
        <Textarea
          className="min-h-24"
          disabled={!meeting.acceptingResponses}
          id={commentId}
          maxLength={1000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="For example: I can join 15 minutes late on Wednesday."
          value={comment}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Your selections and note autosave after a short pause.</span>
          <span>{comment.length}/1000</span>
        </div>
      </div>
    </section>
  );
}

function GridRow({
  dates,
  meetingOpen,
  onKeyboardToggle,
  onPointerDown,
  selected,
  slotByCell,
  time,
}: {
  dates: PublicMeetingDto["dates"];
  meetingOpen: boolean;
  onKeyboardToggle: (slotStart: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    slotStart: string,
  ) => void;
  selected: Set<string>;
  slotByCell: Map<string, PublicMeetingDto["slots"][number]>;
  time: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-white/10 bg-card/95 px-3 py-5 text-xs text-muted-foreground backdrop-blur-xl">
        {time}
      </div>
      {dates.map((date) => {
        const slot = slotByCell.get(`${date.date}:${time}`);
        if (!slot) return <div key={date.date} />;
        const active = selected.has(slot.datetimeStart);
        return (
          <div
            className="min-h-14 border-b border-r border-white/10 p-1.5 last:border-r-0"
            key={date.date}
          >
            <motion.button
              aria-label={`${active ? "Remove" : "Select"} ${date.label} at ${time}`}
              aria-pressed={active}
              className={`relative size-full min-h-11 touch-pan-y rounded-xl border transition duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary ${
                active
                  ? "border-primary/80 bg-primary/75 shadow-[0_0_18px_-8px_oklch(0.82_0.18_245_/_0.85)] hover:bg-primary/85"
                  : "border-white/8 bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.06]"
              }`}
              data-slot-start={slot.datetimeStart}
              disabled={!meetingOpen}
              onClick={(event) => {
                if (event.detail === 0) onKeyboardToggle(slot.datetimeStart);
              }}
              onPointerDown={(event) =>
                onPointerDown(event, slot.datetimeStart)
              }
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            />
          </div>
        );
      })}
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const contents = {
    idle: { icon: <Cloud />, label: "Autosave ready" },
    dirty: { icon: <Cloud />, label: "Changes pending" },
    saving: {
      icon: <LoaderCircle className="animate-spin" />,
      label: "Saving…",
    },
    saved: { icon: <CheckCircle2 />, label: "Saved" },
    error: { icon: <CloudOff />, label: "Not saved" },
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
