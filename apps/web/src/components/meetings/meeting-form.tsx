"use client";

import type { OrganizerMeetingDto } from "@meet-planner/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SchedulePicker } from "@/components/meetings/schedule-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/auth-api";
import {
  createMeeting,
  type MeetingInput,
  updateMeeting,
} from "@/lib/meeting-api";

export function MeetingForm({ meeting }: { meeting?: OrganizerMeetingDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [startDate, setStartDate] = useState(meeting?.startDate ?? tomorrow());
  const [endDate, setEndDate] = useState(meeting?.endDate ?? tomorrow());
  const [workdayStart, setWorkdayStart] = useState(
    meeting?.workdayStart ?? "08:00",
  );
  const [workdayEnd, setWorkdayEnd] = useState(meeting?.workdayEnd ?? "20:00");
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState<30 | 60>(
    meeting?.slotIntervalMinutes ?? 60,
  );
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState<
    30 | 60 | 90 | 120
  >(meeting?.meetingDurationMinutes ?? 60);
  const [timezone, setTimezone] = useState(meeting?.timezone ?? "Africa/Tunis");
  const [responseDeadline, setResponseDeadline] = useState(
    meeting?.responseDeadline
      ? toLocalDateTimeInput(meeting.responseDeadline)
      : "",
  );
  const [formError, setFormError] = useState<string>();
  const timezones = useMemo(
    () =>
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : ["Africa/Tunis", "UTC", "Europe/Paris", "America/New_York"],
    [],
  );

  const mutation = useMutation({
    mutationFn: (input: MeetingInput) =>
      meeting ? updateMeeting(meeting.id, input) : createMeeting(input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({
        title: meeting ? "Meeting updated" : "Meeting created",
        description: meeting
          ? "Your schedule and invitation details are up to date."
          : "Your private invitation is ready to share.",
        variant: "success",
      });
      router.push(`/dashboard/meetings/${saved.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (!endDate || endDate < startDate) {
      setFormError("End date must be on or after the start date.");
      return;
    }
    if (workdayEnd <= workdayStart) {
      setFormError("Working hours must end after they start.");
      return;
    }
    if (
      meetingDurationMinutes >
      minutesFromTime(workdayEnd) - minutesFromTime(workdayStart)
    ) {
      setFormError(
        "Meeting duration cannot be longer than the daily scheduling window.",
      );
      return;
    }
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate,
      workdayStart,
      workdayEnd,
      slotIntervalMinutes,
      meetingDurationMinutes,
      timezone,
      responseDeadline: responseDeadline
        ? new Date(responseDeadline).toISOString()
        : null,
    });
  }

  const serverError = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : "Unable to reach Synk. Is the API running?"
    : undefined;

  return (
    <form className="space-y-7" noValidate onSubmit={submit}>
      {(formError || serverError) && (
        <div
          className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {formError ?? serverError}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="title">
          Meeting title
        </label>
        <Input
          id="title"
          maxLength={120}
          minLength={2}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="INSAT Robotics Weekly Meeting"
          required
          value={title}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          className="min-h-28"
          id="description"
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should participants know before choosing a time?"
          value={description}
        />
      </div>

      <SchedulePicker
        endDate={endDate}
        minDate={meeting ? undefined : today()}
        onEndDateChange={setEndDate}
        onIntervalChange={(interval) => {
          setSlotIntervalMinutes(interval);
          if (meetingDurationMinutes % interval !== 0) {
            setMeetingDurationMinutes(interval);
          }
        }}
        onStartDateChange={setStartDate}
        onWorkdayEndChange={setWorkdayEnd}
        onWorkdayStartChange={setWorkdayStart}
        slotIntervalMinutes={slotIntervalMinutes}
        startDate={startDate}
        workdayEnd={workdayEnd}
        workdayStart={workdayStart}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="meeting-duration">
            Meeting duration
          </label>
          <select
            className="auth-input"
            id="meeting-duration"
            onChange={(event) =>
              setMeetingDurationMinutes(
                Number(event.target.value) as 30 | 60 | 90 | 120,
              )
            }
            value={meetingDurationMinutes}
          >
            {([30, 60, 90, 120] as const)
              .filter((duration) => duration % slotIntervalMinutes === 0)
              .map((duration) => (
                <option className="bg-card" key={duration} value={duration}>
                  {formatDuration(duration)}
                </option>
              ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Synk uses this length when ranking and finalizing top matches.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="timezone">
            Timezone
          </label>
          <select
            className="auth-input"
            id="timezone"
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          >
            {timezones.map((zone) => (
              <option className="bg-card" key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <LabeledInput
          id="response-deadline"
          label="Response deadline (optional)"
          onChange={setResponseDeadline}
          type="datetime-local"
          value={responseDeadline}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
        <Button onClick={() => router.back()} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          className="h-10 px-5"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending && <LoaderCircle className="animate-spin" />}
          {meeting ? "Save changes" : "Create meeting"}
        </Button>
      </div>
    </form>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function LabeledInput({
  id,
  label,
  min,
  onChange,
  type,
  value,
}: {
  id: string;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={type !== "datetime-local"}
        type={type}
        value={value}
      />
    </div>
  );
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
