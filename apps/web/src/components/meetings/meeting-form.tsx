"use client";

import type { OrganizerMeetingDto } from "@meet-planner/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { localizedErrorMessage } from "@/lib/localized-error";
import {
  createMeeting,
  type MeetingInput,
  updateMeeting,
} from "@/lib/meeting-api";

const SchedulePicker = dynamic(
  () =>
    import("@/components/meetings/schedule-picker").then(
      (module) => module.SchedulePicker,
    ),
  { loading: () => <MeetingFormLoading /> },
);

export function MeetingForm({ meeting }: { meeting?: OrganizerMeetingDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { formatDuration, locale, t } = useI18n();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [startDate, setStartDate] = useState(meeting?.startDate ?? tomorrow());
  const [endDate, setEndDate] = useState(meeting?.endDate ?? tomorrow());
  const [workdayStart, setWorkdayStart] = useState(
    meeting?.workdayStart ?? "08:00",
  );
  const [workdayEnd, setWorkdayEnd] = useState(meeting?.workdayEnd ?? "20:00");
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(
    meeting?.meetingDurationMinutes ?? 60,
  );
  const [timezone, setTimezone] = useState(meeting?.timezone ?? "Africa/Tunis");
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
        title: meeting ? t("Meeting updated") : t("Meeting created"),
        description: meeting
          ? t("Your schedule and invitation details are up to date.")
          : t("Your private invitation is ready to share."),
        variant: "success",
      });
      router.push(`/dashboard/meetings/${saved.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (!endDate || endDate < startDate) {
      setFormError(t("End date must be on or after the start date."));
      return;
    }
    if (workdayEnd <= workdayStart) {
      setFormError(t("Working hours must end after they start."));
      return;
    }
    if (
      meetingDurationMinutes >
      minutesFromTime(workdayEnd) - minutesFromTime(workdayStart)
    ) {
      setFormError(
        t("Meeting duration cannot be longer than the daily scheduling window."),
      );
      return;
    }
    mutation.mutate({
      title: title.trim(),
      description: description.trim(),
      startDate,
      endDate,
      workdayStart,
      workdayEnd,
      slotIntervalMinutes: 15,
      meetingDurationMinutes,
      timezone,
    });
  }

  const serverError = mutation.error
    ? localizedErrorMessage(
        mutation.error,
        locale,
        t,
        "Unable to reach Synk. Is the API running?",
      )
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
          {t("Meeting title")}
        </label>
        <Input
          id="title"
          maxLength={120}
          minLength={2}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("Weekly robotics meeting")}
          required
          value={title}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          {t("Description")}{" "}
          <span className="text-muted-foreground">({t("optional")})</span>
        </label>
        <Textarea
          className="min-h-28"
          id="description"
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("What should participants know before choosing a time?")}
          value={description}
        />
      </div>

      <SchedulePicker
        endDate={endDate}
        minDate={meeting ? undefined : today()}
        onEndDateChange={setEndDate}
        onStartDateChange={setStartDate}
        onWorkdayEndChange={setWorkdayEnd}
        onWorkdayStartChange={setWorkdayStart}
        startDate={startDate}
        workdayEnd={workdayEnd}
        workdayStart={workdayStart}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="meeting-duration">
              {t("Meeting duration")}
            </label>
            <output
              className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-primary"
              htmlFor="meeting-duration"
            >
              {formatDuration(meetingDurationMinutes)}
            </output>
          </div>
          <input
            aria-valuetext={formatDuration(meetingDurationMinutes)}
            className="duration-slider w-full"
            id="meeting-duration"
            max={360}
            min={15}
            onChange={(event) => {
              const duration = Number(event.target.value);
              setMeetingDurationMinutes(duration);
            }}
            step={15}
            type="range"
            value={meetingDurationMinutes}
          />
          <div className="flex justify-between text-[0.65rem] text-muted-foreground">
            <span>{t("15 min")}</span>
            <span>{t("1 hour")}</span>
            <span>{t("3 hours")}</span>
            <span>{t("6 hours")}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              "Drag the slider in 15-minute steps. Synk uses this exact duration for suggestions and finalization.",
            )}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="timezone">
            {t("Timezone")}
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
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
        <Button onClick={() => router.back()} type="button" variant="outline">
          {t("Cancel")}
        </Button>
        <Button
          className="h-10 px-5"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending && <LoaderCircle className="animate-spin" />}
          {meeting ? t("Save changes") : t("Create meeting")}
        </Button>
      </div>
    </form>
  );
}

function MeetingFormLoading() {
  const { t } = useI18n();
  return (
    <div
      className="min-h-96 animate-pulse rounded-lg border border-white/10 bg-white/[0.025]"
      role="status"
    >
      <span className="sr-only">{t("Loading schedule picker…")}</span>
    </div>
  );
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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
