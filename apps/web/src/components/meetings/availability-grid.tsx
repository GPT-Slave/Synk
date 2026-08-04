"use client";

import type {
  AvailabilitySlotDto,
  ParticipantSessionDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/auth-api";
import { saveAvailability } from "@/lib/meeting-api";

interface AvailabilityGridProps {
  meeting: PublicMeetingDto;
  participantSession: ParticipantSessionDto;
  sessionToken: string;
  token: string;
}

export function AvailabilityGrid({
  meeting,
  participantSession,
  sessionToken,
  token,
}: AvailabilityGridProps) {
  const [selected, setSelected] = useState(
    () =>
      new Set(
        participantSession.availabilities.map((slot) => slot.datetimeStart),
      ),
  );
  const dragMode = useRef<"select" | "remove" | null>(null);
  const touchedSlot = useRef<string | undefined>(undefined);
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
  const mutation = useMutation({
    mutationFn: (slots: AvailabilitySlotDto[]) =>
      saveAvailability(token, sessionToken, slots),
  });

  useEffect(() => {
    function finishDrag() {
      dragMode.current = null;
      touchedSlot.current = undefined;
    }
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, []);

  function applySlot(slotStart: string) {
    if (!dragMode.current || touchedSlot.current === slotStart) return;
    touchedSlot.current = slotStart;
    setSelected((current) => {
      const next = new Set(current);
      if (dragMode.current === "select") next.add(slotStart);
      else next.delete(slotStart);
      return next;
    });
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    slotStart: string,
  ) {
    if (!meeting.acceptingResponses || event.button !== 0) return;
    event.preventDefault();
    dragMode.current = selected.has(slotStart) ? "remove" : "select";
    touchedSlot.current = undefined;
    applySlot(slotStart);
  }

  function continueDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragMode.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const slot = element?.closest<HTMLElement>("[data-slot-start]");
    if (slot?.dataset.slotStart) applySlot(slot.dataset.slotStart);
  }

  function toggleFromKeyboard(slotStart: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slotStart)) next.delete(slotStart);
      else next.add(slotStart);
      return next;
    });
  }

  function save() {
    const slots = meeting.slots
      .filter((slot) => selected.has(slot.datetimeStart))
      .map((slot) => ({
        datetimeStart: slot.datetimeStart,
        datetimeEnd: slot.datetimeEnd,
      }));
    mutation.mutate(slots);
  }

  const error = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : "Your availability could not be saved."
    : undefined;

  return (
    <section className="mt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Responding as</p>
          <h2 className="mt-1 text-xl font-semibold">
            {participantSession.participant.displayName}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Click or drag across every hour that works. Touch dragging works on
            phones and tablets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle2 className="size-4" /> Saved
            </span>
          )}
          <Button
            disabled={!meeting.acceptingResponses || mutation.isPending}
            onClick={save}
            type="button"
          >
            {mutation.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Save />
            )}
            Save availability
          </Button>
        </div>
      </div>

      {error && (
        <p
          className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-blue-100"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <div
          className="grid min-w-max select-none"
          onPointerMove={continueDrag}
          style={{
            gridTemplateColumns: `5rem repeat(${meeting.dates.length}, minmax(7.5rem, 1fr))`,
            touchAction: "pan-x",
          }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-white/10 bg-card/95" />
          {meeting.dates.map((date) => (
            <div
              className="border-b border-r border-white/10 px-3 py-3 text-center text-xs font-medium last:border-r-0"
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
    event: PointerEvent<HTMLButtonElement>,
    slotStart: string,
  ) => void;
  selected: Set<string>;
  slotByCell: Map<string, PublicMeetingDto["slots"][number]>;
  time: string;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r border-white/10 bg-card/95 px-3 py-4 text-xs text-muted-foreground">
        {time}
      </div>
      {dates.map((date) => {
        const slot = slotByCell.get(`${date.date}:${time}`);
        if (!slot) return <div key={date.date} />;
        const active = selected.has(slot.datetimeStart);
        return (
          <button
            aria-label={`${active ? "Remove" : "Select"} ${date.label} at ${time}`}
            aria-pressed={active}
            className={`min-h-12 border-b border-r border-white/10 transition last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary ${
              active
                ? "bg-primary/75 shadow-[inset_0_0_0_1px_oklch(0.9_0.11_240_/_0.5)] hover:bg-primary/85"
                : "bg-transparent hover:bg-white/[0.06]"
            }`}
            data-slot-start={slot.datetimeStart}
            disabled={!meetingOpen}
            key={date.date}
            onClick={(event) => {
              if (event.detail === 0) onKeyboardToggle(slot.datetimeStart);
            }}
            onPointerDown={(event) => onPointerDown(event, slot.datetimeStart)}
            type="button"
          />
        );
      })}
    </>
  );
}
