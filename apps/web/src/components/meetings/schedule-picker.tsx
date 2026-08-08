"use client";

import { CalendarRange, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface SchedulePickerProps {
  endDate: string;
  minDate?: string;
  onEndDateChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onWorkdayEndChange: (value: string) => void;
  onWorkdayStartChange: (value: string) => void;
  startDate: string;
  workdayEnd: string;
  workdayStart: string;
}

export function SchedulePicker({
  endDate,
  minDate,
  onEndDateChange,
  onStartDateChange,
  onWorkdayEndChange,
  onWorkdayStartChange,
  startDate,
  workdayEnd,
  workdayStart,
}: SchedulePickerProps) {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] shadow-lg">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
          {t("Schedule window")}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          {t("Pick the days and hours visually")}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("Choose a start square, then an end square—just like booking a stay.")}
        </p>
      </div>

      <DateRangeCalendar
        endDate={endDate}
        minDate={minDate}
        onEndDateChange={onEndDateChange}
        onStartDateChange={onStartDateChange}
        startDate={startDate}
      />

      <TimeRangeGrid
        onEndChange={onWorkdayEndChange}
        onStartChange={onWorkdayStartChange}
        rangeEnd={workdayEnd}
        rangeStart={workdayStart}
      />
    </section>
  );
}

function DateRangeCalendar({
  endDate,
  minDate,
  onEndDateChange,
  onStartDateChange,
  startDate,
}: Pick<
  SchedulePickerProps,
  "endDate" | "minDate" | "onEndDateChange" | "onStartDateChange" | "startDate"
>) {
  const { t } = useI18n();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    firstOfMonth(parseDate(startDate) ?? new Date()),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string>();
  const preview = useMemo(() => {
    if (!selectingEnd || !hoveredDate) {
      return { start: startDate, end: endDate };
    }
    return orderRange(startDate, hoveredDate);
  }, [endDate, hoveredDate, selectingEnd, startDate]);

  function selectDate(date: string) {
    if (minDate && date < minDate) return;
    if (!selectingEnd) {
      onStartDateChange(date);
      onEndDateChange("");
      setSelectingEnd(true);
      return;
    }

    const next = orderRange(startDate, date);
    onStartDateChange(next.start);
    onEndDateChange(next.end);
    setSelectingEnd(false);
    setHoveredDate(undefined);
  }

  const canGoBack = !minDate || dateKey(visibleMonth) > monthKey(minDate);

  return (
    <div className="border-b border-white/10 p-5 sm:p-7">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <CalendarRange className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("Date range")}</p>
            <p className="text-xs text-muted-foreground">
              {selectingEnd
                ? t("Now choose the last day")
                : t("Choose the first day")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
          <RangeSummary
            label={t("Start")}
            value={startDate}
            active={!selectingEnd}
          />
          <RangeSummary
            label={t("End")}
            value={endDate}
            active={selectingEnd}
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Button
          aria-label={t("Previous month")}
          disabled={!canGoBack}
          onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <p className="text-xs text-muted-foreground sm:hidden">
          {t("Select two dates")}
        </p>
        <Button
          aria-label={t("Next month")}
          onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {[visibleMonth, addMonths(visibleMonth, 1)].map((month) => (
          <Month
            key={dateKey(month)}
            minDate={minDate}
            month={month}
            onHover={setHoveredDate}
            onSelect={selectDate}
            rangeEnd={preview.end}
            rangeStart={preview.start}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  minDate,
  month,
  onHover,
  onSelect,
  rangeEnd,
  rangeStart,
}: {
  minDate?: string;
  month: Date;
  onHover: (date?: string) => void;
  onSelect: (date: string) => void;
  rangeEnd: string;
  rangeStart: string;
}) {
  const days = useMemo(() => monthDays(month), [month]);
  const reduceMotion = useReducedMotion();
  const { formatDate } = useI18n();
  return (
    <div>
      <h3 className="mb-4 text-center text-sm font-semibold">
        {formatDate(month, { month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7 text-center text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
        {weekdays(formatDate).map((weekday) => (
          <span className="py-2" key={weekday}>
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map(({ date, outside }, index) => {
          const disabled = outside || Boolean(minDate && date < minDate);
          const rangeStartDate = date === rangeStart;
          const rangeEndDate = date === rangeEnd;
          const endpoint = !outside && (rangeStartDate || rangeEndDate);
          const inside = Boolean(
            rangeStart && rangeEnd && date > rangeStart && date < rangeEnd,
          );
          const inRange = !outside && (endpoint || inside);
          const singleSelectedDate = rangeStartDate && !rangeEnd;
          const startsVisibleSegment =
            inRange && (rangeStartDate || index % 7 === 0);
          const endsVisibleSegment =
            inRange && (rangeEndDate || singleSelectedDate || index % 7 === 6);
          return (
            <motion.button
              aria-label={formatDate(parseDate(date)!, { dateStyle: "full" })}
              aria-pressed={inRange}
              className={`relative h-11 text-sm outline-none transition duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary ${
                inRange ? "bg-primary/16 text-foreground" : ""
              } ${startsVisibleSegment ? "rounded-s-xl" : ""} ${
                endsVisibleSegment ? "rounded-e-xl" : ""
              } ${disabled ? "cursor-default text-white/20" : "hover:bg-white/[0.07]"}`}
              disabled={disabled}
              key={date}
              onClick={() => onSelect(date)}
              onMouseEnter={() => onHover(date)}
              onMouseLeave={() => onHover(undefined)}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            >
              <span
                className={`relative z-10 grid size-9 place-items-center rounded-xl transition duration-200 ${
                  endpoint
                    ? "bg-primary font-semibold text-primary-foreground shadow-glow"
                    : ""
                }`}
              >
                {Number(date.slice(-2))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function TimeRangeGrid({
  onEndChange,
  onStartChange,
  rangeEnd,
  rangeStart,
}: {
  onEndChange: (value: string) => void;
  onStartChange: (value: string) => void;
  rangeEnd: string;
  rangeStart: string;
}) {
  const reduceMotion = useReducedMotion();
  const { formatDuration, t } = useI18n();
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredMinute, setHoveredMinute] = useState<number>();
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => hour),
    [],
  );
  const savedStart = minutesFromLabel(rangeStart);
  const savedEnd = minutesFromLabel(rangeEnd);
  const preview =
    selectingEnd && hoveredMinute !== undefined
      ? orderMinuteRange(savedStart, hoveredMinute, 15)
      : { start: savedStart, end: savedEnd };

  function selectTime(minute: number) {
    if (!selectingEnd) {
      onStartChange(labelFromMinutes(minute));
      onEndChange(labelFromMinutes(minute + 15));
      setSelectingEnd(true);
      return;
    }

    const next = orderMinuteRange(savedStart, minute, 15);
    onStartChange(labelFromMinutes(next.start));
    onEndChange(labelFromMinutes(next.end));
    setSelectingEnd(false);
    setHoveredMinute(undefined);
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Clock3 className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("Daily working hours")}</p>
            <p className="text-xs text-muted-foreground">
              {selectingEnd
                ? t("Choose the last time quarter")
                : t("Choose the first time quarter")}
            </p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-xs font-medium text-primary">
            {t("Quarter-hour slots")}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {t(
              "Each hour is split into four independently selectable quarters.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          {rangeStart}
        </span>
        <span className="text-muted-foreground">{t("to")}</span>
        <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          {rangeEnd}
        </span>
        <span className="text-xs text-muted-foreground">
          · {t("{duration} each selected day", { duration: formatDuration(savedEnd - savedStart) })}
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        onMouseLeave={() => setHoveredMinute(undefined)}
      >
        {hours.map((hour) => (
          <div
            className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.02]"
            key={hour}
          >
            <div className="grid grid-cols-4">
              {[0, 15, 30, 45].map((quarter) => {
                const minute = hour * 60 + quarter;
                const active = minute >= preview.start && minute < preview.end;
                const endpoint =
                  minute === preview.start || minute + 15 === preview.end;
                const time = labelFromMinutes(minute);
                return (
                  <motion.button
                    aria-label={t("Select {time}", { time })}
                    aria-pressed={active}
                    className={`min-h-14 outline-none transition duration-200 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-primary ${
                      endpoint
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : active
                          ? "bg-primary/20 text-foreground"
                          : "hover:bg-white/[0.07]"
                    }`}
                    key={quarter}
                    onClick={() => selectTime(minute)}
                    onMouseEnter={() => setHoveredMinute(minute)}
                    title={time}
                    type="button"
                    whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  />
                );
              })}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm font-medium tabular-nums text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            >
              {String(hour).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeSummary({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  const { formatDate, t } = useI18n();
  return (
    <div
      className={`min-w-32 px-4 py-2.5 first:border-e first:border-white/10 ${active ? "bg-primary/10" : ""}`}
    >
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium">
        {value
          ? formatDate(value, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : t("Select date")}
      </p>
    </div>
  );
}

function weekdays(formatDate: ReturnType<typeof useI18n>["formatDate"]) {
  const sunday = new Date(2026, 0, 4, 12);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(sunday);
    day.setDate(day.getDate() + offset);
    return formatDate(day, { weekday: "short" });
  });
}

function monthDays(month: Date) {
  const first = firstOfMonth(month);
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 42 }, () => {
    const result = {
      date: dateKey(cursor),
      outside: cursor.getMonth() !== month.getMonth(),
    };
    cursor.setDate(cursor.getDate() + 1);
    return result;
  });
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function monthKey(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function orderRange(first: string, second: string) {
  return first <= second
    ? { start: first, end: second }
    : { start: second, end: first };
}

function minutesFromLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function labelFromMinutes(value: number) {
  if (value === 1_440) return "24:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function orderMinuteRange(first: number, second: number, interval: number) {
  return first <= second
    ? { start: first, end: Math.min(1_440, second + interval) }
    : { start: second, end: Math.min(1_440, first + interval) };
}
