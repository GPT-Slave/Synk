"use client";

import type { OrganizerMeetingDto } from "@meet-planner/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/auth-api";
import {
  createMeeting,
  type MeetingInput,
  updateMeeting,
} from "@/lib/meeting-api";

export function MeetingForm({ meeting }: { meeting?: OrganizerMeetingDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [startDate, setStartDate] = useState(meeting?.startDate ?? tomorrow());
  const [endDate, setEndDate] = useState(meeting?.endDate ?? tomorrow());
  const [workdayStart, setWorkdayStart] = useState(
    meeting?.workdayStart ?? "08:00",
  );
  const [workdayEnd, setWorkdayEnd] = useState(meeting?.workdayEnd ?? "20:00");
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
      router.push(`/dashboard/meetings/${saved.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (endDate < startDate) {
      setFormError("End date must be on or after the start date.");
      return;
    }
    if (workdayEnd <= workdayStart) {
      setFormError("Working hours must end after they start.");
      return;
    }
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate,
      workdayStart,
      workdayEnd,
      timezone,
      responseDeadline: responseDeadline
        ? new Date(responseDeadline).toISOString()
        : null,
    });
  }

  const serverError = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : "Unable to reach Calendra. Is the API running?"
    : undefined;

  return (
    <form className="space-y-7" noValidate onSubmit={submit}>
      {(formError || serverError) && (
        <div
          className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-blue-100"
          role="alert"
        >
          {formError ?? serverError}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="title">
          Meeting title
        </label>
        <input
          className="auth-input"
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
        <textarea
          className="min-h-28 w-full resize-y rounded-xl border border-input bg-white/5 px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 hover:border-white/20 focus:border-primary focus:ring-3 focus:ring-primary/15"
          id="description"
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should participants know before choosing a time?"
          value={description}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="size-4 text-primary" /> Date range
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput
            id="start-date"
            label="Start date"
            onChange={setStartDate}
            type="date"
            value={startDate}
          />
          <LabeledInput
            id="end-date"
            label="End date"
            min={startDate}
            onChange={setEndDate}
            type="date"
            value={endDate}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="flex items-center gap-2 text-sm font-medium">
          <Clock3 className="size-4 text-primary" /> Working hours
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput
            id="workday-start"
            label="From"
            onChange={setWorkdayStart}
            type="time"
            value={workdayStart}
          />
          <LabeledInput
            id="workday-end"
            label="To"
            onChange={setWorkdayEnd}
            type="time"
            value={workdayEnd}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
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
      <input
        className="auth-input"
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

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
